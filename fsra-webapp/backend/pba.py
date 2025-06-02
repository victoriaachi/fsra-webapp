from flask import Blueprint, jsonify, request
from gemini import call_gemini_pba
import requests
from docx import Document 
from doc2docx import convert
import os

pba_bp = Blueprint('pba', __name__)

@pba_bp.route('/pba', methods=['POST'])
def submit_keyword():
    data = request.json
    url = "https://www.ontario.ca/laws/statute/90p08"
    doc_path = "./pba.doc"
    docx_path = "./pba_converted.docx"
    keyword = data.get('keyword', '').strip()
    print(f"Received keyword in blueprint: {keyword}")


    
    try:
        # Convert .doc to .docx
        convert(doc_path)
        # Extract text from converted .docx
        doc = Document("./pba.docx")
        pba_text = "\n".join([para.text for para in doc.paragraphs])
        #print(pba_text)

        prompt = f"""
You are an actuary. Using the content in the following text, define the term "{keyword} and give the section/reference
If the term cannot be found in the following text or if it is not related to pensions, return "Please enter a word that is related to pensions"".

Content:
{pba_text}
"""

        gemini_response = call_gemini_pba(prompt)
        definition = gemini_response.strip()  # assuming it returns plain text
        print(definition)
    except Exception as e:
        print("Error calling Gemini:", e)
        return jsonify({"error": "Failed to get definition from Gemini"}), 500

    return jsonify({
        "message": f"Keyword '{keyword}' received successfully!",
        "keyword": keyword,
        "definition": definition
    })


