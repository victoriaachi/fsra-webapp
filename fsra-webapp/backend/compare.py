from flask import Blueprint, request, jsonify
from flask_cors import CORS
import pdfplumber

compare_bp = Blueprint('compare', __name__, url_prefix='/compare')

@compare_bp.route('/', methods=['POST'])
def compare():
    ais = request.files.get('ais')
    avr = request.files.get('avr')

    if not ais or not avr:
        return jsonify({"error": "Missing files"}), 400

    try:
        with pdfplumber.open(ais) as pdf_ais, pdfplumber.open(avr) as pdf_avr:
            ais_text = pdf_ais.pages[0].extract_text()
            avr_text = pdf_avr.pages[0].extract_text()

        return jsonify({
            "ais_first_page_text": ais_text,
            "avr_first_page_text": avr_text
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
