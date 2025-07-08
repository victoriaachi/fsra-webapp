# from flask import Blueprint, jsonify, request
# from gemini import call_gemini_compare
# import requests
# from docx import Document 
# from doc2docx import convert
# import os
# from doc_download import get_pba_text
# import json

# pba_bp = Blueprint('pba', __name__)

# @pba_bp.route('/pba', methods=['POST'])
# def submit_keyword():
#     data = request.json
#     # url = "https://www.ontario.ca/laws/statute/90p08"
#     # doc_path = "./pba.doc"
#     # docx_path = "./pba_converted.docx"
#     keyword = data.get('keyword', '').strip()
#     print(f"Received keyword in blueprint: {keyword}")

#     try: 
#         pba_text = get_pba_text();
#     #try:
#         # Convert .doc to .docx
#         #convert(doc_path)
#         # Extract text from converted .docx
#         #doc = Document("./pba.docx")
#         #pba_text = "\n".join([para.text for para in doc.paragraphs])
#         #print(pba_text)

#         prompt = f"""
# You are an actuary. Using the content in the following text, define the term "{keyword}. 
# If a clear definition is found, return it.
# If the term is mentioned, return a best-guess explanation with source section.
# If the term does not appear or cannot be defined from the text, return "" for all fields.
# Give the section number and the few sentences of text you got your definition from.
# Please return the results as JSON with this format:
# {{
#     "definition": "",
#     "section_name": "",
#     "section_text": ""
#   }}

# Content:
# {pba_text}
# """

#         gemini_response = call_gemini_compare(prompt)
#         try:
#             gemini_fields = json.loads(gemini_response)
#             definition = gemini_fields.get("definition", "NULL")
#             section_name = gemini_fields.get("section_name", "NULL")
#             section_text = gemini_fields.get("section_text", "NULL")

#             # Convert empty strings to None
#             definition = None if definition == "" else definition
#             section_name = None if section_name == "" else section_name
#             section_text = None if section_text == "" else section_text

#             print("Parsed JSON from Gemini:", gemini_fields)
#         except json.JSONDecodeError:
#             print("⚠️ Could not parse Gemini response as JSON:\n", gemini_response)
#             return jsonify({"error": "Gemini returned invalid JSON"}), 500

#     except Exception as e:
#         print("Error calling Gemini:", e)
#         return jsonify({"error": "Failed to get definition from Gemini"}), 500

#     return jsonify({
#         "message": f"Keyword '{keyword}' received successfully!",
#         "keyword": keyword,
#         "definition": definition,
#         "section_name": section_name,
#         "section_text": section_text
#     })


