from flask import Blueprint, jsonify, request
import os
import json, requests, re, copy, array
import pymupdf, pdfplumber
import pandas as pd
from rapidfuzz import fuzz
from datetime import datetime
from itertools import combinations, product
from compare_template import key_map, field_names, exclude, ratios, rounding, dates, dates_excl, table_check, table_other, gc_mortality, solv_mortality, plan_info_keys, val_date, plan_info_titles, misc_text, found, dc_nc, sensitivity, membership, solv_incr
from compare_clean_text import clean_text, clean_numbers_val, clean_numbers_pdf, format_numbers
from compare_word_match import avr_match_dec, extract_num, extract_sum, find_period

fuzzy_threshold = 40 
sum_fuzzy_threshold = 60
sparkle_fuzzy_threshold = 60
window_size = 250
max_combo = 3
sum_tol = 0.01

compare_bp = Blueprint('compare', __name__)
@compare_bp.route('/compare', methods=['GET', 'POST'])
def compare_route():

    if request.method == 'GET':
        return jsonify({"message": "Compare endpoint is live!"})
    if 'ais' not in request.files or 'avr' not in request.files:
        return jsonify({"error": "Missing PDF files"}), 400

    ais_file = request.files['ais']
    avr_file = request.files['avr']

    print("AIS filename:", ais_file.filename)
    print("AVR filename:", avr_file.filename)

    # variable names
    keys = list(key_map.keys());
    titles = copy.deepcopy(field_names);
    # values in ais
    ais_vals = [""]*len(key_map);
    ais_display = [""]*len(key_map);
    avr_vals = ["not matched"]*len(key_map);

    # page numbers
    avr_pages = ["not matched"]*len(key_map);
    avr_dates = []
    incr_pages = []
    pages_text = []

    # value metadata - percent, negative, etc
    ais_meta = [""]*len(key_map);
    avr_meta = [""]*len(key_map);

    # boolean array to keep track of values that are found
    ais_found = [0]*len(key_map);
    avr_found = [0]*len(key_map);
    compare = [0]*len(key_map);
    valid_field = [0]*len(key_map);

    # trackers
    fields_found = 0
    fields_not_found = 0
    fields_excl = 0  

    # solvency incremental cost
    incremental_cost = 0
    num_years = 0

    # tracking functions
    def mark_found(i, counter):
        compare[i] = 1
        counter += 1
    
    def mark_not_found(i, counter):
        compare[i] = 0
        counter += 1

    def mark_exclude(i, counter):
        compare[i] = 3
        counter += 1

    try:
        # extract text from ais
        ais_doc = pymupdf.open(stream=ais_file.read(), filetype="pdf")
        ais_text = ""
        field_count = 0
        ais_found_fields = 0;
        seen_fields = set()  
        parsing_include = 0
        parsing_exclude = 0
        for page in ais_doc:
            for field in page.widgets():
                field_val = field.field_value
                field_name = field.field_name
                if field_name in seen_fields:
                    continue

                elif field_name in exclude or field_count in dates_excl or titles[field_count] == "" or field_val is None or field_val == "":
                    ais_vals[field_count] = "NULL"
                    field_count += 1;
                    parsing_exclude += 1
                    seen_fields.add(field_name)
                
                elif field_name not in seen_fields:
                    cleaned_val = clean_numbers_val(field_val, ais_meta, field_count)
                    if field_count in ratios:
                        ais_meta[field_count] = "%"
                    ais_text += f"{field_count} {titles[field_count]}: {field_val}\n"
                    ais_found_fields += 1
                    valid_field[field_count] = 1
                    ais_vals[field_count] = cleaned_val
                    ais_display[field_count] = field_val
                    seen_fields.add(field_name)
                    field_count += 1
                    parsing_include += 1 

        ais_doc.close()

        # for checking lines 125-127
        titles[204] = ais_vals[203]
        titles[206] = ais_vals[205]

        # solv incr cost 
        num_years = find_period(ais_vals[3], ais_vals[4])
        incremental_cost = extract_num(ais_vals[solv_incr]) * num_years
        incremental_cost = str(incremental_cost)
        ais_vals[solv_incr] = str(incremental_cost)


        with pdfplumber.open(avr_file) as avr_pdf:
            for i, page in enumerate(avr_pdf.pages, start=1):
                text = page.extract_text() or ""
                pages_text.append(text)
                if "incremental cost" in text.lower() and i >= 10:
                    incr_pages.append(i)  

        avr_text = "\n".join(pages_text)
        avr_text = clean_text(avr_text);
        avr_text = clean_numbers_pdf(avr_text, avr_dates);

        not_num = 0;
        zero = 0
        special_rounding_indices = set(ratios) | set(rounding) 
        compare_invalid = 0
        compare_no_num = 0
        compare_zero = 0
        compare_rounding = 0
        compare_table = 0
        compare_reg = 0

        for i, val in enumerate(ais_vals):
            # exclude
            if i in misc_text:
                mark_exclude(i, fields_excl)
                compare_no_num += 1
            # exclude
            elif i in found or i in plan_info_keys or i in dc_nc or i in membership or i in sensitivity:
                mark_found(i, fields_found)
                compare_no_num += 1
            # exclude
            elif valid_field[i] == 0:
                mark_exclude(i, fields_excl)
                compare_invalid += 1
                continue
            # exclude
            elif val == "0":
                mark_exclude(i, fields_excl)
                compare_zero += 1
                continue
            # other text for tables 
            elif i in table_other:
                mark_exclude(i, fields_excl)
                compare_no_num += 1
            # "other" checked for mortality table
            elif i in table_check and val == "5":
                compare_table += 1

                target = ais_vals[i+1].strip().lower()
                matched = False

                for sentence in avr_text.split('\n'):
                    score = fuzz.partial_ratio(target, sentence.lower())
                    if score >= fuzzy_threshold:
                        mark_found(i, fields_found)
                        matched = True
                        print(f"✅ Fuzzy match (score={score}) for table_other target '{target}' in: {sentence.strip()}")
                        break

                if not matched:
                    mark_not_found(i, fields_not_found)
                    # compare[i+1] = 0
                    print(f"❌ Not found - table_other target '{target}'")
            
            # checkmark in tables
            elif i in table_check:

                compare_table += 1
                if i == 104:
                    #ais_vals[i] = gc_mortality[int(val)-2]
                    if gc_mortality[int(val) - 2] in avr_text:

                        mark_found(i, fields_found)
                    else:
                        mark_not_found(i, fields_not_found)
                else:
                    if solv_mortality[int(val) - 1] in avr_text:
                        mark_found(i, fields_found)
                    else:
                        mark_not_found(i, fields_not_found)
            elif extract_num(val) is None or extract_num(val) == "":
                mark_exclude(i, fields_excl)
                not_num += 1
                compare_no_num += 1
            
            # solvency incremental cost
            elif i == solv_incr:
                if ais_vals[solv_incr] in avr_text:
                    mark_found(i, fields_found)
                    print("solv incremental found in avr")
                else: 
                    ais_vals[solv_incr] = str(incremental_cost)
                    compare_rounding += 1

                    variants = [str(int(float(ais_vals[i])) + offset) for offset in range(-3, 4)]

                    print(f"🔎 Checking numeric/rounded variants for '{val}': {variants}")

                    best_score = 0
                    best_context = ""
                    found_match = False

                    for variant in variants:
                        pattern = r'\b' + re.escape(variant) + r'\b'
                        matches = list(re.finditer(pattern, avr_text))

                        for match in matches:
                            match_pos = match.start()
                            context_start = max(0, match_pos - 250)
                            context_end = min(len(avr_text), match_pos + 250)
                            context = avr_text[context_start:context_end]
                    

                            score = fuzz.partial_ratio(titles[i].lower(), context.lower())
                            if score > best_score:
                                best_score = score
                                best_context = context
                                found_match = True
                                

                    if best_score >= fuzzy_threshold and found_match:
                        mark_found(i, fields_found)
                        print(f"✅ Found nearby numeric variant of '{val}' (score={best_score})")
                    else:
                        mark_not_found(i, fields_not_found)
                        print(f"❌ No numeric variant matched '{val}' (max score={best_score})")


            
            # percentage / rounded numbers — exact numeric variant match, fuzzy title match
            elif i in special_rounding_indices:
                compare_rounding += 1
                variants = avr_match_dec(val, is_percent=('%' in ais_meta[i]))
                print(f"🔎 Checking rounded/percentage variants for '{val}': {variants}")

                best_score = 0
                best_context = ""
                found_match = False

                for variant in variants:
                    pattern = r'\b' + re.escape(variant) + r'\b'
                    matches = list(re.finditer(pattern, avr_text))

                    for match in matches:
                        match_pos = match.start()

                        # Define a fixed window around the match positioxfn (e.g., ±250 chars)
                        context_start = max(0, match_pos - 250)
                        context_end = min(len(avr_text), match_pos + 250)
                        context = avr_text[context_start:context_end]

                        score = fuzz.partial_ratio(titles[i].lower(), context.lower())
                        if score > best_score:
                            best_score = score
                            best_context = context
                            found_match = True
                            print(f"score {score}")

                if best_score >= fuzzy_threshold and found_match:
                    mark_found(i, fields_found)
                    print(f"✅ Found variant of '{val}' with strong title match (score={best_score})")

                else:
                    mark_not_found(i, fields_not_found)
                    print(f"❌ No valid context/title match found for any variant of '{val}' (max score={best_score})")

            # regular number checking
            else:
                compare_reg += 1
                pattern = r'\b' + re.escape(val) + r'\b'
                matches = list(re.finditer(pattern, avr_text))

                if not matches:
                    mark_not_found(i, fields_not_found)
                    print(f"❌ Number '{val}' not found as standalone in AVR.")
                else:
                    best_score = 0
                    best_context = ""

                    for match in matches:
                        match_pos = match.start()

                        # Use a character window (±250 chars around match)
                        context_start = max(0, match_pos - 250)
                        context_end = min(len(avr_text), match_pos + 250)
                        context = avr_text[context_start:context_end]

                        score = fuzz.partial_ratio(titles[i].lower(), context.lower())
                        if score > best_score:
                            best_score = score
                            best_context = context

                    if best_score >= fuzzy_threshold:
                        mark_found(i, fields_found)
                        print(f"✅ Number '{val}' found, and title '{titles[i]}' matched in context (score={best_score})")
                    else:
                        mark_not_found(i, fields_not_found)
                        print(f"⚠️ Number '{val}' found, but no strong match for title '{titles[i]}' (max score={best_score})")

        # scale checking
        thousands_phrases = ["in thousands", "in thousand", "thousands of dollars"]
        millions_phrases = ["in millions", "in million", "millions of dollars"]

        scale = None
        for phrase in thousands_phrases:
            if fuzz.partial_ratio(phrase.lower(), avr_text.lower()) >= fuzzy_threshold:
                scale = 1000
                break

        if scale is None:
            for phrase in millions_phrases:
                if fuzz.partial_ratio(phrase.lower(), avr_text.lower()) >= fuzzy_threshold:
                    scale = 1000000
                    break

        print(f"Scale detected: {scale}")

        if scale in (1000, 1000000):
            for i, val in enumerate(ais_vals):
                if compare[i] == 0 and val != "NULL":
                    num = extract_num(val)
                    if num is None:
                        continue

                    scaled_val = clean_numbers_val(str(num / scale), [], 0)
                    pattern = r'\b' + re.escape(scaled_val) + r'\b'
                    matches = list(re.finditer(pattern, avr_text))

                    best_score = 0
                    best_context = ""

                    for match in matches:
                        match_pos = match.start()
                        context_start = max(0, match_pos - 250)
                        context_end = min(len(avr_text), match_pos + 250)
                        context = avr_text[context_start:context_end]

                        score = fuzz.partial_ratio(titles[i].lower(), context.lower())
                        if score > best_score:
                            best_score = score
                            best_context = context

                    if best_score >= fuzzy_threshold:
                        mark_found(i, fields_found)
                        print(f"✅ Scaled match for '{titles[i]}' → Value: {scaled_val} (score={best_score})")
                    else:
                        mark_not_found(i, fields_not_found)
                        print(f"❌ Scaled value '{scaled_val}' found, but no strong title match (max score={best_score})")
        else:
            print("❌ No scale phrase detected, skipping scaled value matching.")

        compare0 = 0
        compare3 = 0
        compare1 = 0
        for i, val in enumerate(compare):
            if val == 0:
                compare0 += 1
                print(f"not found: {keys[i]} {ais_vals[i]}")

            elif val == 3:
                compare3 += 1
            elif val == 1:
                compare1 += 1
        print(f"not found: {compare0}")

        # sum checking
        for i, val in enumerate(compare):
            if val == 0:
                title = titles[i]
                expected_value = extract_num(ais_vals[i])  # expected numeric value

                if expected_value is None or abs(expected_value) < 1000:
                    continue

                best_match = None
                best_score = 0

                found_combo = False  # flag to track if sum combo is found

                for m in re.finditer(r'.{0,250}', avr_text):
                    snippet = m.group()
                    score = fuzz.token_set_ratio(snippet.lower(), title.lower())

                    if score >= sum_fuzzy_threshold:

                        nums_nearby = extract_sum(avr_text, m.start(), m.end(), window_size)

                        for combo_size in range(2, min(max_combo, len(nums_nearby)) + 1):
                            for combo in combinations(nums_nearby, combo_size):
                                # Try all +/- sign combinations for the current combo
                                for signs in product([1, -1], repeat=len(combo)):
                                    signed_sum = sum(s * n for s, n in zip(signs, combo))
                                    if abs(signed_sum - expected_value) < 0.01:
                                        compare[i] = 1  # mark found
                                        print(f"✅ Match found with +/- signs for index {titles[i]} {i}: {combo} → target: {expected_value}, actual: {signed_sum} near fuzzy match with score {score}")
                                        found_combo = True
                                        break
                                if found_combo:
                                    break

                            if found_combo:
                                break

                    if found_combo:
                        break  

     
        not_found = compare.count(0)

        # mortality table display
        for i, val in enumerate(ais_vals):
            if i == 104:
                ais_display[i] = gc_mortality[int(val)-2]
            elif i == 158:
                ais_display[i] = solv_mortality[int(val)-1]
            elif i == solv_incr:
                ais_display[i] = ais_vals[i]

        # finding avr incremental cost        
        keyword = "incremental cost"
        windows = []

        date_variants = avr_dates
        date_variants = [extract_num(n) for n in date_variants if extract_num(n) is not None]
        original_dates = list(date_variants)

        for n in original_dates:
            date_variants.append(n+1)
            date_variants.append(n-1)

        # reading avr text

        flat_numbers = [num for match in re.finditer(keyword, avr_text, flags=re.IGNORECASE)
                for num in re.findall(r"\d+(?:\.\d+)?", avr_text[max(0, match.start()):match.end()+200])]
        clean_nums = [extract_num(n) for n in flat_numbers]
        clean_nums = [n for n in clean_nums if n not in date_variants]

        if clean_nums is not None:
            avr_vals[solv_incr] = max(clean_nums)
        else:
            avr_vals[solv_incr] = "not matched"
        if scale and abs(avr_vals[solv_incr]*scale - extract_num(ais_vals[solv_incr])) < abs(avr_vals[solv_incr] - extract_num(ais_vals[solv_incr])):
            avr_vals[solv_incr] = avr_vals[solv_incr] * scale

        if avr_vals[solv_incr] != extract_num(ais_vals[solv_incr]):
            compare[solv_incr] = 0

        # display forcomparison
        filtered_titles = [titles[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_ais_values = [ais_display[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_avr_values = [avr_vals[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_page_numbers = [avr_pages[i] for i in range(len(compare))if compare[i] == 0]
        filtered_ais_values = format_numbers(filtered_ais_values)
        filtered_avr_values = format_numbers(filtered_avr_values)

        filtered_plan_info = [ais_vals[i] for i in plan_info_keys]
        for idx in [2, 3]:
            try:
                date_str = filtered_plan_info[idx]
                date_obj = datetime.strptime(date_str, "%Y%m%d")
                filtered_plan_info[idx] = date_obj.strftime("%B %d, %Y")
            except Exception as e:
                print(f"Error parsing date at index {idx}: {e}")
        try:

            display_fields = list(zip(filtered_titles, filtered_ais_values, filtered_avr_values, filtered_page_numbers))
            plan_info = list(zip(plan_info_titles, filtered_plan_info))
        except Exception as e:
            print(f"Error parsing valuation date: {e}")

        return jsonify({
            "result": "Received both files successfully!",
            "ais_text": ais_text,
            "avr_text": avr_text,
            "mismatched_fields": display_fields,
            "plan_info": plan_info, 
        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500
