# compare.py
from flask import Blueprint, jsonify, request
import requests
import fitz
import pandas as pd
from gemini import call_gemini 
import pdfplumber
import json

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
You are an actuary. From the text below, extract the following 10 fields:

1. Market value of assets  
2. Total liabilities  
3. Solvency ratio  
4. Number of Ontario plan members  
5. Employer contribution 2024  
6. Employer contribution 2025  
7. Special payments required  
8. Average annual pension for salaried members  
9. Total retired IVHS members  
10. Funded status  

Please return the results as JSON with this format:
{{
  "total_assets": "...",
  "total_liabilities": "...",
  "solvency_ratio": "...",
  "number_of_ontario_members": "...",
  "employer_contribution_2024": "...",
  "employer_contribution_2025": "...",
  "special_payments_required": "...",
  "avg_annual_pension_salaried": "...",
  "retired_ivhs_members": "...",
  "funded_status": "..."
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

        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "ais_text": ais_text,
            #"gemini_text": gemini_text,
            "avr_length": len(avr_text),
            "avr_text": avr_text,
            "gemini_fields": json.loads(gemini_text)
            #"ollama_text": result
            #"excel_data_preview": excel_df.head(10).to_dict()

        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500

    