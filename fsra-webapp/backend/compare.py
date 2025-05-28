# compare.py
from flask import Blueprint, jsonify, request
import pdfplumber, fitz

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

        
        # Extract text from AVR
        with pdfplumber.open(avr_file) as avr_pdf:
            avr_text = ""
            for page in avr_pdf.pages:
                avr_text += page.extract_text() + "\n"

        # Just print them in the terminal for now
        #print("\n===== AIS PDF TEXT =====\n")
        #print(ais_text)
        #print("\n===== AVR PDF TABLES =====\n")
        #print(avr_text)

        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "ais_text": ais_text,
            "avr_length": len(avr_text),
            "avr_text": avr_text,
        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500