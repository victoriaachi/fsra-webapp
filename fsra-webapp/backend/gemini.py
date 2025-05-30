import google.generativeai as genai


# Configure Gemini once
genai.configure(api_key="AIzaSyBZpiIY4SowywMml4IdUJddsFZn98WDWJQ")

# Reusable function
def call_gemini(prompt):
    model = genai.GenerativeModel("gemini-1.5-flash", generation_config={"response_mime_type": "application/json"})
    response = model.generate_content(prompt)
    return response.text
