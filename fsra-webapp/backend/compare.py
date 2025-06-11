# compare.py
from flask import Blueprint, jsonify, request
import requests
import fitz
#import pandas as pd
from gemini import call_gemini_compare
import pdfplumber
import json
import re
import copy
import array
from rapidfuzz import fuzz
from value_compare import val_equal, extract_num
from template import key_map, titles, exclude, ratios, rounding
from clean_text import clean_text, clean_numbers_val, clean_numbers_pdf
from word_match import find_nearest_word, find_nearest_number, avr_match_dec

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

    #titles_str = ", ".join(titles)
    print(f"Exclude set before loop: {exclude}")


    try:
        # Extract text from AIS
        ais_doc = fitz.open(stream=ais_file.read(), filetype="pdf")  # read file bytes directly
        ais_text = ""
        field_count = 0
        ais_found_fields = 0;
        seen_fields = set()  # track field names we already processed
        null = 0
        for page in ais_doc:
            for field in page.widgets():
                field_val = field.field_value
                field_name = field.field_name
                #print(f"{field_count} {field_name} {field_val}")
                if field_name in seen_fields:
                    continue
                    #print("seen")
                    
                elif field_name in exclude:
                    #print("excluded")
                    field_count += 1
                    seen_fields.add(field_name)

                elif field_val is None or field_val == "":
                    #print("null")
                    ais_vals[field_count] = "NULL"
                    null += 1
                    field_count += 1;
                    seen_fields.add(field_name)
                
                elif field_name not in seen_fields:
                    #print("valid")
                    field_val = clean_numbers_val(field_val, ais_meta, field_count)
                    ais_text += f"{field_count} {field_name}: {field_val} {ais_found_fields}\n"
                    ais_found_fields += 1
                    #ais_vals[field_count] = extracted_val
                    #ais_found[field_count] = 1
                    ais_vals[field_count] = field_val
                    seen_fields.add(field_name)
                    field_count += 1
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

        # for i, val in enumerate(ais_vals):
        #     print(f"Index: {i}, Value: {val}")



        with pdfplumber.open(avr_file) as avr_pdf:
            avr_text = ""
            for page in avr_pdf.pages:
                avr_text += page.extract_text() + "\n"

        avr_text = clean_numbers_pdf(clean_text(avr_text));
        print(avr_text)

        found = 0; 
        not_num = 0;
        # Combine the sets/lists of indices you want special rounding matching for
        special_rounding_indices = set(ratios) | set(rounding)

        for i, val in enumerate(ais_vals):
            #print(f"Processing field {i} ({keys[i]}): {val} (type: {type(val)})")
            if val != "NULL" and val and extract_num(val) is None:
                #print("not num")
                #print(val)
                not_num += 1
                compare[i] = 1
                continue  # Skip to next index

            if val != "NULL" and val:
                #print("special number checking")
                if i in special_rounding_indices:
                    # Here, call a flexible matching function that:
                    # - compares val as decimal to val*100 (percent),
                    # - compares rounded versions to handle many decimals,
                    # - uses your fuzzy matching to find closest in avr_text
                    variants = avr_match_dec(val, is_percent=('%' in ais_meta[i]))
 # Make sure this generates variants e.g. val, val*100, rounded etc.

                    matched = False
                    for variant in variants:
                        match, score = find_nearest_number(avr_text, variant, threshold=100, decimals=1)
                        if match:
                            found += 1
                            compare[i] = 1
                            matched = True
                            break
                    if not matched:
                        compare[i] = 0
                else:
                    #print("regular number checking")
                    # Regular fuzzy number match
                    match, score = find_nearest_number(avr_text, val, threshold=100)
                    if match:
                        found += 1
                        compare[i] = 1



        not_null = len(key_map) - ais_vals.count("NULL")        


        # ais_found = found + not_found + not_num

        for i in range(383, 390):
            compare[i] = 1

        print("Checking scale phrases in AVR text...")
        print(f"AVR text snippet: {avr_text[:500]}")  # print first 500 chars for context

        thousands_phrases = ["in thousands", "in thousand", "thousands of dollars"]
        millions_phrases = ["in millions", "in million", "millions of dollars"]

        found_thousands = False
        found_millions = False

        for phrase in thousands_phrases:
            score = fuzz.partial_ratio(phrase.lower(), avr_text.lower())
            print(f"Checking thousands phrase '{phrase}': score = {score}")
            if score > 80:
                found_thousands = True
                break

        for phrase in millions_phrases:
            score = fuzz.partial_ratio(phrase.lower(), avr_text.lower())
            print(f"Checking millions phrase '{phrase}': score = {score}")
            if score > 80:
                found_millions = True
                break

        scale = None
        if found_thousands:
            scale = 1000
        elif found_millions:
            scale = 1000000

        print(f"Scale detected: {scale}")

        if scale == 1000 or scale == 1000000:
            for i, val in enumerate(ais_vals):
                if compare[i] == 0 and val != "NULL" and val:
                    num = extract_num(val)
                    #print(str(num))
                    if num is None:
                        continue

                    scaled_val = clean_numbers_val(str(num / scale), [], 0)
                    print(scaled_val)

                    # For ratios, optionally try also dividing to cover cases like 107 vs 0.107
                    # variants = [scaled_val]
                    # if i in ratios:
                    #     variants.append(str(num / scale))

                    matched = False
                    variants = [scaled_val]
                    for variant in variants:
                        match, score = find_nearest_number(avr_text, variant, threshold=100)
                        if match:
                            compare[i] = 1
                            matched = True
                            print(f"Scaled match for index {i}, val {val}, variant {variant}")
                            break
        else:
            print("No scale phrase detected, skipping scaled matching")
            


        not_found = 0
        for i, val in enumerate(compare):
            if ais_vals[i] != "NULL" and ais_vals[i] and val == 0:
                not_found += 1
                #print(f"metadata: {ais_meta[i]}")
                print(f"not found: {keys[i]} {ais_vals[i]}")
        print(f"found: {found}")
        print(f"total fields: {ais_found_fields}")
        print(f"words: {not_num}")
        print(f"null/excluded fields: {null}")
        print(f"not found: {not_found}")

#         prompt = f"""
# You are an actuary. From the text below, extract the following fields in this list only if there is a numerical number in it: {titles_str}. 
# If you cannot find a field or if does not contain numbers, return "". If the value is a date, please return it in YYYYMMDD format.

# Please return the results as JSON with this format:
# {{
#     "field_1": "",
#     "field_2": ""
#   }}

# Text:
# {avr_text}
# """

#         gemini = call_gemini_compare(prompt)
#         print(gemini)

#         try:
#             gemini_fields = json.loads(gemini)
            
 
#         except json.JSONDecodeError:
#             gemini_fields = {"error": "Gemini returned invalid JSON"}
#             print("⚠️ Could not parse Gemini response as JSON:\n", gemini_text)

#         try:
#             parsed_json = json.loads(gemini)
#             avr_vals = list(parsed_json.values())
#             print("parsing worked")
#             print("List of values:", avr_vals)
#             for i, val in enumerate(avr_vals):
#                 if val is not None and val != "":
#                     avr_found[i] = 1;
#             print(avr_found)
#             print(ais_found)
#         except json.JSONDecodeError as e:
#             print("JSON parsing error:", e)
#             print("Raw output:", gemini_text)


#         # Now compare ais_json and gemini_fields ----- ais list
#         print("Comparison between ais list and Gemini Fields (json):")
#         for i, (ais_val, avr_val) in enumerate(zip(ais_vals, avr_vals)):
#             print(f"Index: {i}")
#             print(f"AIS Value: {ais_val}")
#             print(f"AVR Value: {avr_val}")

#             if avr_found[i] == 0 and ais_found[i] == 0: # both are not found
#                 compare[i] = 1;
#             elif avr_found[i] == 0 or ais_found[i] == 0: # found/not found
#                 compare[i] = 0;
#             else: # both found, compare first
#                 if val_equal(ais_val, avr_val):
#                     print("match")
#                     compare[i] = 1;
#                 else:
#                     print("different")
#                     compare[i] = 0;
        
#         for i, (ais_val, avr_val, compare_val) in enumerate(zip(ais_vals, avr_vals, compare)):
#             print(i)
#             if compare_val == 0:
#                 print(f"ais value: {ais_val}, avr value: {avr_val}")



        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "ais_text": ais_text,
            "avr_length": len(avr_text),
            "avr_text": avr_text,
            #"gemini_fields": gemini_fields

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500

    