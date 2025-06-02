# compare.py
from flask import Blueprint, jsonify, request
import requests
import fitz
import pandas as pd
from gemini import call_gemini_compare
import pdfplumber
import json
import re
import copy
import array
from value_compare import val_equal, extract_num
from template import key_map, titles

# llm = ChatOpenAI(
#     temperature=0,
#     model="gpt-3.5-turbo",
#     openai_api_key=os.getenv("OPENAI_API_KEY", "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")
# )

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

    #ais_dict = copy.deepcopy(key_map);
    # variable names
    keys = list(key_map.keys());
    # values in ais
    ais_vals = [""]*len(key_map);
    avr_vals = [""]*len(key_map);
    # titles to display/ask api
    # titles = list(key_map); ---------- already imported
    # boolean array to keep track of values that are found
    ais_found = [0]*len(key_map);
    avr_found = [0]*len(key_map);
    compare = [0]*len(key_map);

    titles_str = ", ".join(titles)


    try:
        # Extract text from AIS
        ais_doc = fitz.open(stream=ais_file.read(), filetype="pdf")  # read file bytes directly
        ais_text = ""
        field_count = 0
        seen_fields = set()  # track field names we already processed

        for page in ais_doc:
            for field in page.widgets():
                if field.field_name not in seen_fields:
                    extracted_val = field.field_value
                    #print(f"{keys[field_count]}: {extracted_val}")
                    if extracted_val is not None:
                        ais_text += f"{field_count} {field.field_name}: {extracted_val}\n"
                        ais_vals[field_count] = extracted_val;
                        ais_found[field_count] = 1;
                        #print(f"{field_count}: {ais_vals[field_count]}")
                        #print(f"{keys[field_count]}");
                        # seen_fields.add(field.field_name)
                        # field_count += 1
                    #ais_text += f"{field.field_name}\n"
                    #ais_text += f"{field_count} {field.field_name}: {field.field_value}\n"
                    seen_fields.add(field.field_name)
                    field_count += 1

        ais_doc.close()

        with pdfplumber.open(avr_file) as avr_pdf:
            avr_text = ""
            for page in avr_pdf.pages:
                avr_text += page.extract_text() + "\n"

        
        #excel_df = pd.read_excel(avr_file, sheet_name="page_7")  # You can add `sheet_name=...` if needed
        #excel_data = excel_df.to_dict(orient='records')  # Convert to list of dicts for JSON
        #excel_data = excel_df.fillna("").to_dict(orient='records')

        # excel_df = pd.read_excel(avr_file, index_col=0, sheet_name="page_7")  # Use first column as row labels
        # excel_data = excel_df.to_dict()  # Now you get a dict of columns
        # excel_data_preview = excel_df.head(10).where(pd.notnull(excel_df), None).to_dict()

        # Just print them in the terminal for now
        #print("\n===== AIS PDF TEXT =====\n")
        #print(ais_text)
        #print("\n===== AVR PDF TABLES =====\n")
        #print(avr_text)
        prompt = f"""
You are an actuary. From the text below, extract the following fields in this list only if there is a numerical number in it: {titles_str}. 
If you cannot find a field or if does not contain numbers, return "". If the value is a date, please return it in YYYYMMDD format.

Please return the results as JSON with this format:
{{
    "field_1": "",
    "field_2": ""
  }}

Text:
{avr_text}
"""

        gemini = call_gemini(prompt)
        print(gemini)
        #gemini_text = gemini.text.strip()

        try:
            gemini_fields = json.loads(gemini)
            
 
        except json.JSONDecodeError:
            gemini_fields = {"error": "Gemini returned invalid JSON"}
            print("⚠️ Could not parse Gemini response as JSON:\n", gemini_text)

        # Load ais.json file (assuming ais.json is in the same directory as compare.py)
        # with open('ais.json', 'r') as f:
        #     ais_json = json.load(f)

        try:
            parsed_json = json.loads(gemini)
            avr_vals = list(parsed_json.values())
            print("parsing worked")
            print("List of values:", avr_vals)
            for i, val in enumerate(avr_vals):
                if val is not None:
                    avr_found[i] = 1;
            print(avr_found)
            print(ais_found)
        except json.JSONDecodeError as e:
            print("JSON parsing error:", e)
            print("Raw output:", gemini_text)


        # Now compare ais_json and gemini_fields ----- ais list
        print("Comparison between ais list and Gemini Fields (json):")
        for i, (ais_val, avr_val) in enumerate(zip(ais_vals, avr_vals)):
            print(f"Index: {i}")
            print(f"AIS Value: {ais_val}")
            print(f"AVR Value: {avr_val}")

            if avr_found[i] == 0 and ais_found[i] == 0: # both are not found
                compare[i] = 1;
            elif avr_found[i] == 0 or ais_found[i] == 0: # found/not found
                compare[i] = 0;
            else: # both found, compare first
                if val_equal(ais_val, avr_val):
                    print("match")
                    compare[i] = 1;
                else:
                    print("different")
                    compare[i] = 0;
        
        for i, (ais_val, avr_val, compare_val) in enumerate(zip(ais_vals, avr_vals, compare)):
            print(i)
            if compare_val == 0:
                print(f"ais value: {ais_val}, avr value: {avr_val}")



        # for key in ais_json.keys():
        #     ais_value = ais_json[key]
        #     gemini_value = gemini_fields.get(key)
        #     if val_equal(ais_value, gemini_value):
        #         print(f"[MATCH] {key}: {ais_value}")
        #     else:
        #         print(f"[DIFFERENT] {key} -> ais.json: {ais_value} | gemini_fields: {gemini_value}")



        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "ais_text": ais_text,
            #"gemini_text": gemini_text,
            "avr_length": len(avr_text),
            "avr_text": avr_text,
            "gemini_fields": gemini_fields
            #"ollama_text": result
            #"excel_data_preview": excel_df.head(10).to_dict()

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500

    