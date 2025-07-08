import google.generativeai as genai


# Configure Gemini once
genai.configure(api_key="AIzaSyBZpiIY4SowywMml4IdUJddsFZn98WDWJQ")

# Reusable function
def call_gemini_compare(prompt):
    model = genai.GenerativeModel("gemini-2.0-flash-lite", generation_config={"response_mime_type": "application/json"})
    response = model.generate_content(prompt)
    return response.text

def call_gemini_pba(prompt):
    model = genai.GenerativeModel("gemini-2.0-flash-lite")
    response = model.generate_content(prompt)
    return response.text
