from flask import Blueprint, jsonify, request
import psutil, os, gc
#from gemini import call_gemini_compare
import json, requests, re, copy, array
import pymupdf, pdfplumber
import pandas as pd
from rapidfuzz import fuzz
from datetime import datetime
from itertools import combinations
from compare_template import key_map, field_names, exclude, ratios, rounding, dates, dates_excl, table_check, table_other, gc_mortality, solv_mortality, plan_info_keys, val_date, plan_info_titles, misc_text, found
from compare_clean_text import clean_text, clean_numbers_val, clean_numbers_pdf, format_numbers
from compare_word_match import avr_match_dec, extract_num, extract_sum

fuzzy_threshold = 40 
sum_fuzzy_threshold = 60
sum_tol = 0.01

compare_bp = Blueprint('compare', __name__)

@compare_bp.route('/compare', methods=['GET', 'POST'])
def compare_route():
    process = psutil.Process(os.getpid())  

    print(f"[START] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")
    if request.method == 'GET':
        return jsonify({"message": "Compare endpoint is live!"})
    if 'ais' not in request.files or 'avr' not in request.files:
        return jsonify({"error": "Missing PDF files"}), 400

    ais_file = request.files['ais']
    avr_file = request.files['avr']
    excel_file = request.files['excel']

    print("AIS filename:", ais_file.filename)
    print("AVR filename:", avr_file.filename)
    print("Excel filename:", excel_file.filename)

    # variable names
    keys = list(key_map.keys());
    titles = copy.deepcopy(field_names);
    # values in ais
    ais_vals = [""]*len(key_map);
    avr_vals = [""]*len(key_map);

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

    #test


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
        # Extract text from AIS
        ais_doc = pymupdf.open(stream=ais_file.read(), filetype="pdf")  # read file bytes directly
        print(f"[After loading AIS PDF] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")
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
                #print(f"{field_count} {field_name} {field_val}")
                if field_name in seen_fields:
                    continue
                    #print("seen")

                elif field_name in exclude or field_count in dates_excl or titles[field_count] == "" or field_val is None or field_val == "":
                    ais_vals[field_count] = "NULL"
                    field_count += 1;
                    parsing_exclude += 1
                    seen_fields.add(field_name)
                
                elif field_name not in seen_fields:
                    print("hello")
                    field_val = clean_numbers_val(field_val, ais_meta, field_count)
                    if field_count in ratios:
                        ais_meta[field_count] = "%"
                    ais_text += f"{field_count} {titles[field_count]} {field_name}: {field_val} {ais_found_fields}\n"
                    ais_found_fields += 1
                    valid_field[field_count] = 1
                    ais_vals[field_count] = field_val
                    seen_fields.add(field_name)
                    field_count += 1
                    parsing_include += 1 

        ais_doc.close()
        # for checking lines 125-127
        titles[204] = ais_vals[203]
        titles[206] = ais_vals[205]

        gc.collect()
        print(f"[After closing AIS PDF] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        # reading avr text

        with pdfplumber.open(avr_file) as avr_pdf:
            pages_text = []
            for page in avr_pdf.pages:
                pages_text.append(page.extract_text() or "")
            avr_text = "\n".join(pages_text)
        print(f"[After loading AVR PDF text] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        avr_text = clean_text(avr_text);
        #avr_text = clean_numbers_pdf(avr_text);
        gc.collect()
        print(f"[After cleaning AVR text] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

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
            if i in misc_text:
                mark_exclude(i, fields_excl)
                compare_no_num += 1
            elif i in found or i in plan_info_keys:
                mark_found(i, fields_found)
                compare_no_num += 1

            #print(f"{i}: {val}")
            # if i >= 383:
            #     continue
            elif valid_field[i] == 0:
                mark_exclude(i, fields_excl)
                compare_invalid += 1
                continue

            elif val == "0":
                mark_exclude(i, fields_excl)
                #print("zero")
                compare_zero += 1
                continue
            # other text for tables 
            elif i in table_other:
                mark_exclude(i, fields_excl)
                compare_no_num += 1

            elif i in table_check and val == "5":
                print("table other")
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
                print(f"{i} table check: {val}")
                if i == 104:
                    if gc_mortality[int(val) - 2] in avr_text:
                        print(f"found gc {gc_mortality[int(val)-2]}")
                        mark_found(i, fields_found)
                    else:
                        mark_not_found(i, fields_not_found)
                        print("not found - gc mortality")
                else:
                    print("else")
                    #print(solv_mortality)
                    if solv_mortality[int(val) - 1] in avr_text:
                        print(f"found solv {solv_mortality[int(val)-1]}")
                        mark_found(i, fields_found)
                    else:
                        print("not found - solv mortality")
                        mark_not_found(i, fields_not_found)
            elif extract_num(val) is None or extract_num(val) == "":
                mark_exclude(i, fields_excl)
                not_num += 1
                compare_no_num += 1
                print("no numbers extracted")
            
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

                        # Define a fixed window around the match position (e.g., ±250 chars)
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
                    print(f"✅ Found variant of '{val}' with strong title match (score={best_score})")
                    print(f"↪ Context: {best_context[:200]}...")
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
                        print(f"↪ Context: {best_context[:200]}...")
                    else:
                        mark_not_found(i, fields_not_found)
                        print(f"⚠️ Number '{val}' found, but no strong match for title '{titles[i]}' (max score={best_score})")

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
                        print(f"↪ Context: {best_context[:200]}...")
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


        fuzzy_sum_threshold = 60
        WINDOW_SIZE = 250
        MAX_COMBO = 3

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

                    if score >= fuzzy_sum_threshold:
                        nums_nearby = extract_sum(avr_text, m.start(), m.end(), WINDOW_SIZE)

                        for combo_size in range(2, min(MAX_COMBO, len(nums_nearby)) + 1):
                            for combo in combinations(nums_nearby, combo_size):
                                if abs(sum(combo) - expected_value) < 0.01:
                                    compare[i] = 1  # mark found
                                    print(f"✅ Sum found for index {i}: {combo} for {titles[i]} {ais_vals[i]} near fuzzy match with score {score}")
                                    found_combo = True
                                    break
                            if found_combo:
                                break

                    if found_combo:
                        break  # no need to check further substrings

        # avr values
        xls = pd.ExcelFile(excel_file, engine="openpyxl")

        financial_pattern = re.compile(r'[\$\(]?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?[\)]?')

        records = []

        for sheet_name in xls.sheet_names:
            df = xls.parse(sheet_name, header=None)
            for row_idx, row in df.iterrows():
                for col_idx, cell in row.items():
                    value = None

                    if isinstance(cell, str):
                        matches = financial_pattern.findall(cell)
                        for match in matches:
                            value = match
                            col_label = str(df.iloc[0, col_idx]) if row_idx > 0 and pd.notna(df.iloc[0, col_idx]) else ""
                            row_label = str(df.iloc[row_idx, 0]) if col_idx > 0 and pd.notna(df.iloc[row_idx, 0]) else ""
                            records.append([value, col_label, row_label, sheet_name])
                    
                    elif isinstance(cell, (int, float)):
                        value = cell
                        col_label = str(df.iloc[0, col_idx]) if row_idx > 0 and pd.notna(df.iloc[0, col_idx]) else ""
                        row_label = str(df.iloc[row_idx, 0]) if col_idx > 0 and pd.notna(df.iloc[row_idx, 0]) else ""
                        records.append([value, col_label, row_label, sheet_name])

        # Create final DataFrame
        merged_df = pd.DataFrame(records, columns=["value", "col label", "row label", "sheet name"])

        # Print full DataFrame without truncation
        print(merged_df)
        # with pd.option_context('display.max_rows', None, 'display.max_columns', None, 'display.width', 1000):
        #     print(merged_df)
        page_8_df = merged_df[merged_df["sheet name"] == "page_8"]


        # Print nicely
        with pd.option_context('display.max_rows', None, 'display.max_columns', None, 'display.width', 1000):
            print(page_8_df)

        not_found = compare.count(0)


        filtered_titles = [titles[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_values = [ais_vals[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_values = format_numbers(filtered_values)

        filtered_plan_info = [ais_vals[i] for i in plan_info_keys]
        for idx in [2, 3]:
            try:
                date_str = filtered_plan_info[idx]
                #print(f"Original date at index {idx}: {date_str}")
                date_obj = datetime.strptime(date_str, "%Y%m%d")
                filtered_plan_info[idx] = date_obj.strftime("%B %d, %Y")
                #print(f"Formatted date at index {idx}: {filtered_plan_info[idx]}")
            except Exception as e:
                print(f"Error parsing date at index {idx}: {e}")

        try:
            date_str = "-".join(ais_vals[i] for i in val_date)
            # print("Raw valuation date string:", date_str)
            # # for i, val in enumerate(ais_vals):
            # #     print(f"{i} {val}")
            # print(f"null/excluded fields: {null}")
            # print(f"fields: {ais_found_fields}")
            # print(f"found: {found}")
            #print(compare)

            parsed_date = datetime.strptime(date_str, "%B-%d-%Y")
            filtered_val_date = parsed_date.strftime("%B %d, %Y")
            # for i, val in enumerate(ais_vals):
            #     print(f"{i}: {val}")
            # print(f"parsing include {parsing_include}")
            # print(f"parsing exclude {parsing_exclude}")
            # print(f"zeros: {compare_zero}, tables: {compare_table}, invalid {compare_invalid}, rounding: {compare_rounding}, regular: {compare_reg}, no num: {compare_no_num}")
            # print(f"found: {fields_found}, not found: {fields_not_found}, excluded: {fields_excl}")
            # print(f"compare 1:{compare1}, 0:{compare0}, 3:{compare3}")
            #print("Formatted valuation date:", filtered_val_date)

            # Insert into results
            filtered_plan_info.insert(2, filtered_val_date)
            display_fields = list(zip(filtered_titles, filtered_values))
            plan_info = list(zip(plan_info_titles, filtered_plan_info))
            #print(plan_info)
            #filtered_plan_titles.insert(2, "Valuation Date")
        except Exception as e:
            print(f"Error parsing valuation date: {e}")
        
        #print(filtered_plan_info)
        # filtered_plan_titles = plan_info_titles
        # print(filtered_plan_titles)

        print(f"[Before returning response] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")
        # print(plan_info)
        # print(display_fields)

        return jsonify({
            "result": "Received both files successfully!",
            "ais_text": ais_text,
            "avr_text": avr_text,
            "mismatched_fields": display_fields,
            "plan_info": plan_info, 
            #"plan_titles": plan_info_titles, 

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500
