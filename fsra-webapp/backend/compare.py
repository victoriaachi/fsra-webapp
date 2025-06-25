from flask import Blueprint, jsonify, request
import psutil, os, gc
from gemini import call_gemini_compare
import json, requests, re, copy, array
import fitz, pdfplumber
from rapidfuzz import fuzz
from datetime import datetime
from compare_template import key_map, field_names, exclude, ratios, rounding, dates, dates_excl, table_check, table_other, gc_mortality, solv_mortality, plan_info, val_date, plan_info_titles
from compare_clean_text import clean_text, clean_numbers_val, clean_numbers_pdf, format_numbers
from compare_word_match import avr_match_dec, extract_num

fuzzy_threshold = 40

compare_bp = Blueprint('compare', __name__)

@compare_bp.route('/compare', methods=['GET', 'POST'])
def compare_route():
    process = psutil.Process(os.getpid())  # get current process info

    print(f"[START] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")
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
    avr_vals = [""]*len(key_map);

    # value metadata - percent, negative, etc
    ais_meta = [""]*len(key_map);
    avr_meta = [""]*len(key_map);

    # boolean array to keep track of values that are found
    ais_found = [0]*len(key_map);
    avr_found = [0]*len(key_map);
    compare = [0]*len(key_map);
    valid_field = [0]*len(key_map);

    #titles_str = ", ".join(titles)
    #print(f"Exclude set before loop: {exclude}")


    try:
        # Extract text from AIS
        ais_doc = fitz.open(stream=ais_file.read(), filetype="pdf")  # read file bytes directly
        print(f"[After loading AIS PDF] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")
        ais_text = ""
        field_count = 0
        ais_found_fields = 0;
        seen_fields = set()  
        null = 0
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
                    #print("null")
                    # delete this later
                    #ais_text += f"{field_count} {titles[field_count]} {field_name}: {field_val} {ais_found_fields}\n"
                    ais_vals[field_count] = "NULL"
                    null += 1
                    field_count += 1;
                    parsing_exclude += 1
                    
                    seen_fields.add(field_name)
                
                elif field_name not in seen_fields:
                    #print("valid")
                    field_val = clean_numbers_val(field_val, ais_meta, field_count)
                    if field_count in ratios:
                        ais_meta[field_count] = "%"
                    ais_text += f"{field_count} {titles[field_count]} {field_name}: {field_val} {ais_found_fields}\n"
                    ais_found_fields += 1
                    valid_field[field_count] = 1
                    #ais_vals[field_count] = extracted_val
                    #ais_found[field_count] = 1
                    ais_vals[field_count] = field_val
                    seen_fields.add(field_name)
                    field_count += 1
                    parsing_include += 1 
                    # #print(f"{keys[field_count]}: {extracted_val}")
                    # #if extracted_val is not None and extracted_val != "":
                    # if field.field_name not in exclude:
                    #     ais_text += f"{field_count} {field.field_name}: {extracted_val}\n"
                    #     ais_vals[field_count] = extracted_val;
                    #     ais_found[field_count] = 1;
                    #     #print(f"{field_count}: {ais_vals[field_count]}")
                    #     #print(f"{keys[field_count]}");
                    #     # seen_fields.add(field.field_name)
                    #     # field_count += 1
                    # #ais_text += f"{field.field_name}\n"
                    # #ais_text += f"{field_count} {field.field_name}: {field.field_value}\n"
                    # seen_fields.add(field.field_name)
                    # field_count += 1

        ais_doc.close()
        # for checking lines 125-127
        titles[204] = ais_vals[203]
        titles[206] = ais_vals[205]
        compare[203] = 1
        compare[205] = 1
        gc.collect()
        print(f"[After closing AIS PDF] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        # reading avr text

        with pdfplumber.open(avr_file) as avr_pdf:
            pages_text = []
            for page in avr_pdf.pages:
                pages_text.append(page.extract_text() or "")
            avr_text = "\n".join(pages_text)
        print(f"[After loading AVR PDF text] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        avr_text = clean_numbers_pdf(clean_text(avr_text));
        gc.collect()
        print(f"[After cleaning AVR text] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        found = 0; 
        not_num = 0;
        not_valid = 0
        zero = 0
        special_rounding_indices = set(ratios) | set(rounding)
        compare_invalid = 0
        compare_no_num = 0
        compare_zero = 0
        compare_rounding = 0
        compare_table = 0
        compare_reg = 0

        fields_found = 0
        fields_not_found = 0
        fields_excl = 0

        for i, val in enumerate(ais_vals):
            #print(f"{i}: {val}")
            # if i >= 383:
            #     continue
            if valid_field[i] == 0:
                compare[i] = 3
                not_valid += 1
                compare_invalid += 1
                fields_excl += 1
                continue

            elif val == "0":
                compare[i] = 3
                zero += 1
                #print("zero")
                compare_zero += 1
                fields_excl += 1
                continue
            # other text for tables 
            elif i in table_other:
                compare_no_num += 1
                fields_excl += 1
                compare[i] = 3
                continue   
            elif i in table_check and val == "5":
                print("table other")
                compare_table += 1
                # print(f"{i} table other: {val}")
                # print(f"{i+1} table other: {ais_vals[i+1]}")

                target = ais_vals[i+1].strip().lower()
                matched = False

                for sentence in avr_text.split('\n'):
                    score = fuzz.partial_ratio(target, sentence.lower())
                    if score >= fuzzy_threshold:
                        compare[i] = 1
                        found += 1
                        fields_found += 1
                        matched = True
                        print(f"✅ Fuzzy match (score={score}) for table_other target '{target}' in: {sentence.strip()}")
                        break

                if not matched:
                    fields_not_found += 1
                    # compare[i] = 0
                    # compare[i+1] = 0
                    print(f"❌ Not found - table_other target '{target}'")



            #elif i + 1 in table_other and ais_vals[i+1] != "NULL": 
                

            
            # checkmark in tables
            elif i in table_check:
                compare_table += 1
                print(f"{i} table check: {val}")
                if i == 104:
                    if gc_mortality[int(val) - 2] in avr_text:
                        print(f"found gc {gc_mortality[int(val)-2]}")
                        compare[i] = 1;
                        found += 1;
                        fields_found += 1
                    else:
                        # compare[i] = 0
                        fields_not_found += 1
                        print("not found - gc mortality")
                else:
                    print("else")
                    #print(solv_mortality)
                    if solv_mortality[int(val) - 1] in avr_text:
                        print(f"found solv {solv_mortality[int(val)-1]}")
                        compare[i] = 1;
                        found += 1;
                        fields_found += 1
                    else:
                        print("not found - solv mortality")
                        fields_not_found += 1
            elif extract_num(val) is None or extract_num(val) == "":
                compare[i] = 3
                not_num += 1
                compare_no_num += 1
                fields_excl += 1
                print("no numbers extracted")
                        # compare[i] = 0
            #print(f"Processing field {i} ({keys[i]}): {val} (type: {type(val)})")
            # words only value -- remove
            # elif val != "NULL" and extract_num(val) is not None:
            #     # date
            #     if i in dates_excl:
            #         print("excluded date")
            #         compare[i] = 1
            #         #not_num += 1
            #     elif i in dates:
            #         print("found date")
            #         if val in avr_text:
            #             compare[i] = 1
            #             found += 1
            #         else:
            #             print("not found date")
            #             compare[i] = 0

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
                    compare[i] = 1
                    fields_found += 1
                    found += 1
                    print(f"✅ Found variant of '{val}' with strong title match (score={best_score})")
                    print(f"↪ Context: {best_context[:200]}...")
                else:
                    #compare[i] = 0
                    fields_not_found += 1
                    print(f"❌ No valid context/title match found for any variant of '{val}' (max score={best_score})")



            # regular number checking
            # regular number checking — exact number match, fuzzy title match
            else:
                compare_reg += 1
                pattern = r'\b' + re.escape(val) + r'\b'
                matches = list(re.finditer(pattern, avr_text))

                if not matches:
                    #compare[i] = 0
                    fields_not_found += 1
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
                        compare[i] = 1
                        found += 1
                        fields_found += 1
                        print(f"✅ Number '{val}' found, and title '{titles[i]}' matched in context (score={best_score})")
                        print(f"↪ Context: {best_context[:200]}...")
                    else:
                        #compare[i] = 0
                        fields_not_found += 1
                        print(f"⚠️ Number '{val}' found, but no strong match for title '{titles[i]}' (max score={best_score})")








        # ais_found = found + not_found + not_num

        for i in range(383, 390):
            compare[i] = 1
            #null += 1

   # ✅ Check for scale phrases in AVR text (e.g., "in thousands" / "in millions")
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

        print(f"📏 Scale detected: {scale}")

        # ✅ Apply scaled comparison using character window context
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
                        compare[i] = 1
                        found += 1
                        print(f"✅ Scaled match for '{titles[i]}' → Value: {scaled_val} (score={best_score})")
                        print(f"↪ Context: {best_context[:200]}...")
                    else:
                        #compare[i] = 0
                        print(f"❌ Scaled value '{scaled_val}' found, but no strong title match (max score={best_score})")
        else:
            print("❌ No scale phrase detected, skipping scaled value matching.")

            


        not_found = 0
        #not_valid = 0
        for i, val in enumerate(compare):
            if val == 0:
                not_found += 1
                #print(f"metadata: {ais_meta[i]}")
                #print(f"not found: {keys[i]} {ais_vals[i]}")
            elif val == 3:
                continue
                #not_valid += 1

 

        for i, val in enumerate(compare):
            if val == 1:
                #print(f"found value: {ais_vals[i]}")
                continue

        filtered_titles = [titles[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_values = [ais_vals[i] for i in range(len(compare)) if compare[i] == 0]
        filtered_values = format_numbers(filtered_values)

        filtered_plan_info = [ais_vals[i] for i in plan_info]
        for idx in [2, 3]:
            try:
                date_str = filtered_plan_info[idx]
                print(f"Original date at index {idx}: {date_str}")
                date_obj = datetime.strptime(date_str, "%Y%m%d")
                filtered_plan_info[idx] = date_obj.strftime("%B %d, %Y")
                print(f"Formatted date at index {idx}: {filtered_plan_info[idx]}")
            except Exception as e:
                print(f"Error parsing date at index {idx}: {e}")

        # Format plan titles
        # filtered_plan_titles = [titles[i].title() for i in plan_info]
        # print("Filtered plan titles:", filtered_plan_titles)

        # Handle valuation date
        try:
            date_str = "-".join(ais_vals[i] for i in val_date)
            # print("Raw valuation date string:", date_str)
            # # for i, val in enumerate(ais_vals):
            # #     print(f"{i} {val}")
            # print(f"null/excluded fields: {null}")
            # print(f"fields: {ais_found_fields}")
            # print(f"found: {found}")
            # print(f"not found: {not_found}")
            # print(f"not valid (should match with null): {not_valid}")
            # print(f"zeroes: {zero}")
            # print(f"not num: {not_num}")
            parsed_date = datetime.strptime(date_str, "%B-%d-%Y")
            filtered_val_date = parsed_date.strftime("%B %d, %Y")
            # for i, val in enumerate(ais_vals):
            #     print(f"{i}: {val}")
            print(f"parsing include {parsing_include}")
            print(f"parsing exclude {parsing_exclude}")
            print(f"zeros: {compare_zero}, tables: {compare_table}, invalid {compare_invalid}, rounding: {compare_rounding}, regular: {compare_reg}, no num: {compare_no_num}")
            print(f"found: {fields_found}, not found: {fields_not_found}, excluded: {fields_excl}")
            #print("Formatted valuation date:", filtered_val_date)

            # Insert into results
            filtered_plan_info.insert(2, filtered_val_date)
            #filtered_plan_titles.insert(2, "Valuation Date")
        except Exception as e:
            print(f"Error parsing valuation date: {e}")
        
        #print(filtered_plan_info)
        # filtered_plan_titles = plan_info_titles
        # print(filtered_plan_titles)

        print(f"[Before returning response] Memory usage: {process.memory_info().rss / 1024**2:.2f} MB")

        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "ais_text": ais_text,
            "avr_length": len(avr_text),
            "avr_text": avr_text,
            "titles": filtered_titles, 
            "values": filtered_values, 
            "plan_info": filtered_plan_info, 
            "plan_titles": plan_info_titles, 
            #"gemini_fields": gemini_fields

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500