# compare.py
from flask import Blueprint, jsonify, request
import pdfplumber 

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
        with pdfplumber.open(ais_file) as ais_pdf:
            ais_text = "\n".join([page.extract_text() or "" for page in ais_pdf.pages])
        
        # Extract text from AVR
        with pdfplumber.open(avr_file) as avr_pdf:
            avr_text = "\n".join([page.extract_text() or "" for page in avr_pdf.pages])

        # Just print them in the terminal for now
        print("\n===== AIS PDF TEXT =====\n")
        print(ais_text)
        print("\n===== AVR PDF TEXT =====\n")
        print(avr_text)

        return jsonify({
            "result": "Received both files successfully!",
            "ais_length": len(ais_text),
            "avr_length": len(avr_text)
        })

    except Exception as e:
        print("Error while processing PDFs:", e)
        return jsonify({"error": "Failed to process PDFs"}), 500