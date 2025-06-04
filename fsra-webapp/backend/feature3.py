from flask import Blueprint, jsonify, request
from fuzzywuzzy import fuzz
from doc_download import get_pba_docx
from gemini import call_gemini_pba

feature3_bp = Blueprint('feature3', __name__)

# Extract all paragraph chunks and track which section they belong to
def extract_chunks_with_sections(doc):
    chunks = []
    current_section = "Unknown Section"
    section_map = {}  # Maps section titles to list of text chunks

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        # Heuristic to detect section titles (can customize as needed)
        if text[:3].strip().isdigit() or text.lower().startswith("section"):
            current_section = text
            section_map[current_section] = []
        else:
            section_map.setdefault(current_section, []).append(text)
            chunks.append({
                "chunk": text,
                "section": current_section
            })

    return chunks, section_map

# Find the best match (only one) based on fuzzy score
def find_best_chunk(chunks, keyword, threshold=70):
    best = None
    for item in chunks:
        score = fuzz.partial_ratio(keyword.lower(), item["chunk"].lower())
        if score >= threshold:
            if not best or score > best["score"]:
                best = {
                    "chunk": item["chunk"],
                    "section": item["section"],
                    "score": score
                }
    return best

@feature3_bp.route('/feature3', methods=['POST'])
def submit_keyword():
    data = request.json
    keyword = data.get('keyword', '').strip()
    print(f"🔍 Received keyword: '{keyword}'")

    if not keyword:
        return jsonify({
            "definition": None,
            "section_name": None,
            "section_text": None
        })

    try:
        doc = get_pba_docx()
        chunks, section_map = extract_chunks_with_sections(doc)
        best_match = find_best_chunk(chunks, keyword)

        if not best_match:
            return jsonify({
                "definition": None,
                "section_name": None,
                "section_text": None
            })

        section_name = best_match["section"]
        big_chunk = best_match["chunk"]
        section_text = "\n".join(section_map.get(section_name, []))

        prompt = (
            f"""Summarize the word '{keyword}' in the following text in 1-2 sentences:\n\n{big_chunk}. 
            If the keyword doesn't appear in the chunk, return "NULL"
            """
        )

        # Call Gemini summarization API (your imported function)
        definition_summary = call_gemini_pba(prompt)

        return jsonify({
            "definition": definition_summary or big_chunk,
            "section_name": section_name,
            "section_text": section_text
        })

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            "definition": None,
            "section_name": None,
            "section_text": None
        }), 500
