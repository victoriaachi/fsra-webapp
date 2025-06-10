import re

def clean_pdf_text(text):
    """
    Removes commas and dollar signs from numbers, and removes slashes from dates.
    """

    # Remove dollar signs and commas from numbers
    def replace_number(match):
        return match.group(0).replace('$', '').replace(',', '')

    number_pattern = r'\b\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\b'
    text = re.sub(number_pattern, replace_number, text)

    # Remove slashes from dates (e.g., 2023/12/31 -> 20231231)
    text = re.sub(r'\b(\d{4})/(\d{2})/(\d{2})\b', r'\1\2\3', text)

    return text


### Example Usage


pdf_text = "The amount is $1,234,567.89. This is a text, with a comma, and another number 987,654. There's also 500 dollars. And word, with a comma."
processed_text = clean_pdf_text(pdf_text)
print(f"Original: {pdf_text}")
print(f"Processed: {processed_text}\n")

pdf_text_2 = "Invoice total: $10,000.50. Account Balance: 2,500.00. Date: 2023/12/31. Item,description,quantity,price. Tax rate is 0.05%."
processed_text_2 = clean_pdf_text(pdf_text_2)
print(f"Original: {pdf_text_2}")
print(f"Processed: {processed_text_2}\n")

pdf_text_3 = "The number is $1,234 and not 1,23. This, is a test."
processed_text_3 = clean_pdf_text(pdf_text_3)
print(f"Original: {pdf_text_3}")
print(f"Processed: {processed_text_3}\n")

pdf_text_4 = "The price is $500, not 500 dollars. My income is $1,000,000.00."
processed_text_4 = clean_pdf_text(pdf_text_4)
print(f"Original: {pdf_text_4}")
print(f"Processed: {processed_text_4}\n")