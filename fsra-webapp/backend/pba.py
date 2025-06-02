from flask import Blueprint, jsonify, request
from gemini import call_gemini_pba
import requests
from bs4 import BeautifulSoup

pba_bp = Blueprint('pba', __name__)

@pba_bp.route('/pba', methods=['POST'])
def submit_keyword():
    data = request.json
    url = "https://www.ontario.ca/laws/statute/90p08"
    keyword = data.get('keyword', '').strip()
    print(f"Received keyword in blueprint: {keyword}")
    # You can process keyword here
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # raise error if invalid response
        soup = BeautifulSoup(response.content, 'html.parser')

        # Step 2: Extract main text content
        page_text = soup.get_text(separator='\n')[:5000]  # limit to 5k chars if needed

        prompt = f"""
You are an actuary. Using the content below, define the term "{keyword}".

Content:
{page_text}
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


