# compare.py
from flask import Blueprint, jsonify, request
import requests
import fitz
import pandas as pd
from gemini import call_gemini 
import pdfplumber
import json
import re
from number_compare import num_equal

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

    try:
        # Extract text from AIS
        ais_doc = fitz.open(stream=ais_file.read(), filetype="pdf")  # read file bytes directly
        ais_text = ""
        field_count = 0;
        for page in ais_doc:
            for field in page.widgets():
                ais_text += str(field_count) + " " + field.field_name + ": " + field.field_value + "\n"
                field_count += 1
            #ais_text += page.get_text() + "\n"
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
You are an actuary. From the text below, extract the following 10 fields, if applicable. Otherwise, return "n/a"

1. Market value of assets  
2. Net Surplus/Deficit
3. Solvency ratio  
4. Number of Ontario plan beneficiaries  
5. Normal cost (defined benefit provision) - employer, period 1
6. Normal cost (defined benefit provision) - employer, period 2   
7. Normal cost (defined benefit provision) - employer, period 3
8. Normal cost (defined benefit provision) - employer, period 4
9. Transfer ratio

Please return the results as JSON with this format:
{{
    "market_value_of_assets": "...",
    "net_surplus_deficit": "..."",
    "solvency_ratio": "1....",
    "number_of_ontario_plan_beneficiaries": "...",
    "normal_cost_(defined_benefit_provision)_employer_period_1": "...",
    "normal_cost_(defined_benefit_provision)_employer_period_2": "...",
    "normal_cost_(defined_benefit_provision)_employer_period_3": ""..."",
    "normal_cost_(defined_benefit_provision)_employer_period_4": ""..."",
    "transfer_ratio": "..."
  }}

Text:
{avr_text}
"""

        gemini_text = call_gemini(prompt)

        try:
            gemini_fields = json.loads(gemini_text)
 
        except json.JSONDecodeError:
            gemini_fields = {"error": "Gemini returned invalid JSON"}
            print("⚠️ Could not parse Gemini response as JSON:\n", gemini_text)

        # Load ais.json file (assuming ais.json is in the same directory as compare.py)
        with open('ais.json', 'r') as f:
            ais_json = json.load(f)

        # Now compare ais_json and gemini_fields
        print("Comparison between ais.json and Gemini Fields:")

        for key in ais_json.keys():
            ais_value = ais_json[key]
            gemini_value = gemini_fields.get(key)
            if num_equal(ais_value, gemini_value):
                print(f"[MATCH] {key}: {ais_value}")
            else:
                print(f"[DIFFERENT] {key} -> ais.json: {ais_value} | gemini_fields: {gemini_value}")



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

    