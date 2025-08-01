from flask import Blueprint, jsonify, request
import os
#from gemini import call_gemini_compare
import json, requests, re, copy, array
import pymupdf, pdfplumber
import pandas as pd
from rapidfuzz import fuzz
from datetime import datetime
from itertools import combinations, product
from compare_template import key_map, field_names, exclude, ratios, rounding, dates, dates_excl, table_check, table_other, gc_mortality, solv_mortality, plan_info_keys, val_date, plan_info_titles, misc_text, found, dc_nc, sensitivity, membership, solv_incr
from compare_clean_text import clean_text, clean_numbers_val, clean_numbers_pdf, format_numbers, clean_sheet_name
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
    excel_file = request.files.get('excel')

    print("AIS filename:", ais_file.filename)
    print("AVR filename:", avr_file.filename)
    if excel_file:
        print("Excel filename:", excel_file.filename)

    # variable names
    keys = list(key_map.keys());
    titles = copy.deepcopy(field_names);
    # values in ais
    ais_vals = [""]*len(key_map);
    ais_display = [""]*len(key_map);
    avr_vals = ["not matched"]*len(key_map);

    # page numbers
    avr_pages = ["not matched"]*len(key_map);
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

    incremental_cost = 0
    num_years = 0
    excel_data = []

    

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
                    #ais_text += f"{field_count} {titles[field_count]} {field_name}: {field_val} {ais_found_fields}\n"
                
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
        num_years = find_period(ais_vals[3], ais_vals[4])
        incremental_cost = extract_num(ais_vals[solv_incr]) * num_years
        incremental_cost = str(incremental_cost)
        ais_vals[solv_incr] = str(incremental_cost)
        date_variants = [ais_vals[i] for i in dates + dates_excl]
        date_variants = [extract_num(n) for n in date_variants if extract_num(n) is not None]
        original_dates = list(date_variants)

        for n in original_dates:
            date_variants.append(n+1)
            date_variants.append(n-1)


        # reading avr text

        with pdfplumber.open(avr_file) as avr_pdf:
            for i, page in enumerate(avr_pdf.pages, start=1):
                text = page.extract_text() or ""
                pages_text.append(text)
                if "incremental cost" in text.lower() and i >= 10:
                    incr_pages.append(i)   # or append(page) if you'll use it inside the context

        avr_text = "\n".join(pages_text)

        avr_text = clean_text(avr_text);
        avr_text = clean_numbers_pdf(avr_text);

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
            elif i in found or i in plan_info_keys or i in dc_nc or i in membership or i in sensitivity:
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
                    #ais_vals[i] = gc_mortality[int(val)-2]
                    if gc_mortality[int(val) - 2] in avr_text:

                        print(f"found gc {gc_mortality[int(val)-2]}")
                        mark_found(i, fields_found)
                    else:
                        mark_not_found(i, fields_not_found)
                        print("not found - gc mortality")
                else:
                    print("else")
                    #ais_vals[i] = solv_mortality[int(val)-1]
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
                        print(f"↪ Context: {best_context[:200]}...")
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
                        print(context)

                        score = fuzz.partial_ratio(titles[i].lower(), context.lower())
                        if score > best_score:
                            best_score = score
                            best_context = context
                            found_match = True
                            print(f"score {score}")

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
                        print(f"↪ Context: {best_context[:100]}...")
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
        print(f"not found: {compare0}")





        print(f"🧪 len(compare) = {len(compare)}, len(titles) = {len(titles)}, len(ais_vals) = {len(ais_vals)}")
        for i, val in enumerate(compare):
            if val == 0:
                title = titles[i]
                expected_value = extract_num(ais_vals[i])  # expected numeric value

                if expected_value is None or abs(expected_value) < 1000:
                    continue

                best_match = None
                best_score = 0

                found_combo = False  # flag to track if sum combo is found
                print("before for loop")

                for m in re.finditer(r'.{0,250}', avr_text):
                    snippet = m.group()
                    score = fuzz.token_set_ratio(snippet.lower(), title.lower())
                    print("a")

                    if score >= sum_fuzzy_threshold:

                        nums_nearby = extract_sum(avr_text, m.start(), m.end(), window_size)
                        print("b")

                        for combo_size in range(2, min(max_combo, len(nums_nearby)) + 1):
                            print("bb")
                            for combo in combinations(nums_nearby, combo_size):
                                print("cc")
                                # Try all +/- sign combinations for the current combo
                                for signs in product([1, -1], repeat=len(combo)):
                                    print("dd")
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
                        break  # no need to check further substrings

        if excel_file:
            print("excel")
            # avr values
            xls = pd.ExcelFile(excel_file, engine="openpyxl")
            financial_pattern = re.compile(r'[\$\(]?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?[\)]?')

            records = []
            for sheet_name in xls.sheet_names:
                cleaned_sheet_name = clean_sheet_name(sheet_name)
                df = xls.parse(sheet_name, header=None)
                current_section = ""  # Tracks the current header label

                for row_idx, row in df.iterrows():
                    first_cell = str(row.iloc[0]).strip().lower() if pd.notna(row.iloc[0]) else ""

                    is_header_row = (
                        row.count() == 1 and  # only one non-empty cell
                        isinstance(row.iloc[0], str) and
                        not financial_pattern.search(row.iloc[0])
                    )

                    if is_header_row:
                        current_section = first_cell  # update the section header
                        continue

                    for col_idx, cell in row.items():
                        value = None

                        # Build row label (composite with section)
                        base_row_label = str(df.iloc[row_idx, 0]).strip() if col_idx > 0 and pd.notna(df.iloc[row_idx, 0]) else ""
                        full_row_label = f"{current_section} {base_row_label}".strip() if current_section else base_row_label

                        # Find nearest non-null column label above this row
                        col_label = ""
                        for r in range(row_idx - 1, -1, -1):
                            above = df.iloc[r, col_idx]
                            if pd.notna(above):
                                col_label = str(above).strip()
                                break

                        # Skip if either label contains "table of contents"
                        if "table of contents" in full_row_label.lower() or "table of contents" in col_label.lower():
                            continue

                        # Parse value
                        if isinstance(cell, str):
                            matches = financial_pattern.findall(cell)
                            for match in matches:
                                value = clean_numbers_pdf(match)
                                records.append([value, col_label, full_row_label, cleaned_sheet_name])

                        elif isinstance(cell, (int, float)):
                            value = cell
                            records.append([value, col_label, full_row_label, cleaned_sheet_name])


            # Create final DataFrame
            merged_df = pd.DataFrame(records, columns=["value", "col label", "row label", "sheet name"])
            merged_df = merged_df.fillna("")
            excel_data = merged_df.to_dict(orient="records")


            # Print full DataFrame without truncation
            #print(merged_df)
            # with pd.option_context('display.max_rows', None, 'display.max_columns', None, 'display.width', 1000):
            #     print(merged_df)
            print(len(compare), len(titles), len(ais_vals), len(avr_vals), len(avr_pages))
            for i, val in enumerate(compare):
                print(f"🧪 i = {i}, len(compare) = {len(compare)}")
                #print("for loop")

                if val == 0:
                    print("val = 0")
                    best_score = 0
                    best_value = None
                    
                    target_title = titles[i].lower()
                    
                    # Loop through each Excel row in merged_df
                    for i, row in merged_df.iterrows():
                        #print("loop")
                        row_label = str(row['row label']).lower()
                        col_label = str(row['col label']).lower()
                        excel_value = row['value']
                        
                        # Compute fuzzy match scores for row label and col label against the title
                        score_row = fuzz.partial_ratio(target_title, row_label)
                        score_col = fuzz.partial_ratio(target_title, col_label)
                        
                        # Use whichever label matches best
                        score = max(score_row, score_col)
                        
                        # Check if this is the best match so far and above threshold
                        if score > best_score and score >= sparkle_fuzzy_threshold:
                            print("if statement")
                            best_score = score
                            best_value = excel_value
                            best_page = row['sheet name']
                    
                    # If a good match was found, update avr_vals[i]
                    if best_value is not None:
                        avr_vals[i] = best_value
                        avr_pages[i] = best_page
                        if best_value == ais_vals[i]:
                            compare[i] = 1  # mark as found only if values match
                        print(f"✅ Excel exact match for '{titles[i]}': assigned '{best_value}' with score {best_score}")

                    if best_value is not None:
                        avr_vals[i] = best_value
                        #compare[i] = 1  # mark as found
                        print(f"✅ Excel fuzzy match for '{titles[i]}': assigned '{best_value}' with score {best_score}")
                
        
        not_found = compare.count(0)

        for i, val in enumerate(ais_vals):
            if i == 104:
                ais_display[i] = gc_mortality[int(val)-2]
            elif i == 158:
                ais_display[i] = solv_mortality[int(val)-1]
            elif i == solv_incr:
                ais_display[i] = ais_vals[i]
        keyword = "incremental cost"
        windows = []

        # Use re.finditer to find all occurrences (case-insensitive)
        # for match in re.finditer(keyword, avr_text, flags=re.IGNORECASE):
            # start = max(0, match.start() - window_size)
            # end = match.end() + 200
            # snippet = avr_text[start:end]

            # # Extract only numbers in this snippet
            # numbers = re.findall(r"\d+(?:\.\d+)?", snippet)
            # windows.append(numbers)

        flat_numbers = [num for match in re.finditer(keyword, avr_text, flags=re.IGNORECASE)
                for num in re.findall(r"\d+(?:\.\d+)?", avr_text[max(0, match.start()):match.end()+200])]
        clean_nums = [extract_num(n) for n in flat_numbers]
        print(f"clean nums {clean_nums}")

        clean_nums = [n for n in clean_nums if n not in date_variants]

        print(f" post clean nums {clean_nums}")  # This will be a list of all snippets
        if clean_nums is not None:
            avr_vals[solv_incr] = max(clean_nums)
        else:
            avr_vals[solv_incr] = "not matched"
        if scale and abs(avr_vals[solv_incr]*scale - extract_num(ais_vals[solv_incr])) < abs(avr_vals[solv_incr] - extract_num(ais_vals[solv_incr])):
            avr_vals[solv_incr] = avr_vals[solv_incr] * scale

        print(f"ais {ais_vals[solv_incr]} {type(ais_vals[solv_incr])} avr {avr_vals[solv_incr]} {type(avr_vals[solv_incr])}")
        if avr_vals[solv_incr] != extract_num(ais_vals[solv_incr]):
            compare[solv_incr] = 0

        for i, val in enumerate(compare):
            if i != solv_incr:
                compare[i] = 1
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
                #print(f"Original date at index {idx}: {date_str}")
                date_obj = datetime.strptime(date_str, "%Y%m%d")
                filtered_plan_info[idx] = date_obj.strftime("%B %d, %Y")
                #print(f"Formatted date at index {idx}: {filtered_plan_info[idx]}")
            except Exception as e:
                print(f"Error parsing date at index {idx}: {e}")

        print("hi")
        print(incr_pages)


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
            display_fields = list(zip(filtered_titles, filtered_ais_values, filtered_avr_values, filtered_page_numbers))
            print(display_fields)
            plan_info = list(zip(plan_info_titles, filtered_plan_info))
            #print(plan_info)
            #filtered_plan_titles.insert(2, "Valuation Date")
        except Exception as e:
            print(f"Error parsing valuation date: {e}")
        
        #print(filtered_plan_info)
        # filtered_plan_titles = plan_info_titles
        # print(filtered_plan_titles)
        print(incremental_cost)
        # print(plan_info)
        # print(display_fields)
        # response_data = {
        #     "compare": compare,
        #     "titles": titles,
        #     "ais_vals": ais_vals,
        #     "avr_vals": avr_vals,
        #     "avr_pages": avr_pages,
        # }

        # # Only include excel_data if it's not empty
        # if excel_data:
        #     response_data["excel_data"] = excel_data

        # return jsonify(response_data)

        return jsonify({
            "result": "Received both files successfully!",
            "ais_text": ais_text,
            "avr_text": avr_text,
            "mismatched_fields": display_fields,
            "plan_info": plan_info, 
            "excel_data": excel_data
            #"plan_titles": plan_info_titles, 

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500
