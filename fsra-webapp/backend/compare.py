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
from value_compare import val_equal, extract_num
from template import key_map, titles, exclude
from clean_text import clean_text, clean_numbers_avr, clean_numbers_ais

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

    # boolean array to keep track of values that are found
    ais_found = [0]*len(key_map);
    avr_found = [0]*len(key_map);
    compare = [0]*len(key_map);

    titles_str = ", ".join(titles)
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
                print(f"{field_count} {field_name} {field_val}")
                print(f"field_count={field_count}, length={len(ais_vals)}")
                if field_name in seen_fields:
                    print("seen")
                    
                elif field_name in exclude:
                    print("excluded")
                    field_count += 1
                    seen_fields.add(field_name)

                elif field_val is None or field_val == "":
                    print("null")
                    ais_vals[field_count] = "NULL"
                    null += 1
                    field_count += 1;
                    seen_fields.add(field_name)
                
                elif field_name not in seen_fields:
                    print("valid")
                    field_val = clean_numbers_ais(field_val)
                    ais_text += f"{field_count} {field_name}: {field_val} {ais_found_fields}\n"
                    ais_found_fields += 1
                    #ais_vals[field_count] = extracted_val
                    #ais_found[field_count] = 1
                    ais_vals[field_count] = clean_numbers_ais(field_val)
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

        avr_text = clean_numbers_avr(clean_text(avr_text));

        found = 0; 
        for i, val in enumerate(ais_vals):
            if val != "NULL" and val and val in avr_text:
                #print(f"Found value at index {i}: {val}")
                found += 1
        not_null = len(key_map) - ais_vals.count("NULL")        
        print(found)
        print(ais_found_fields)
        print(not_null)
        print(null)


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

    