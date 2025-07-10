import re
from datetime import datetime

def clean_sheet_name(name):
    match = re.search(r'page_(\d+)', name)
    if match:
        return match.group(1)
    else:
        return name  


# cleans up non-words, etc in avr text
def clean_text(text):
    lines = text.split("\n")
    lines = [line for line in lines if re.search(r'\w', line) and not re.match(r'^\W+$', line)]
    return "\n".join(lines)

# cleans ais field values and updates metadata array
def clean_numbers_val(text, arr, index):
    
    # removes brackets 
    if text.startswith('(') and text.endswith(')'):
        arr[index] += "-"
        text = text[1:-1].strip()

    # remove negative signs
    if text.startswith('-'):
        arr[index] += "-"
        text = text[1:].strip()

    # remove commas 
    def remove_commas(match):
        return match.group(0).replace(',', '')

    comma_pattern = r'\d{1,3}(?:,\d{3})+(?:\.\d+)?'
    text = re.sub(comma_pattern, remove_commas, text)

    # remove dashes from dates
    iso_date_pattern = r'\b(\d{4})-(\d{2})-(\d{2})\b'
    text = re.sub(iso_date_pattern, r'\1\2\3', text)

    # remove leading/trailing zeroes
    if re.fullmatch(r'\d+(\.\d+)?', text):
        if '.' in text:
            # floats
            text = str(float(text)).rstrip('0').rstrip('.')  
        else:
            # ints
            text = str(int(text))  
    return text


# cleans numbers in avr text
def clean_numbers_pdf(text):

    def replace_number(match):
        matched_str = match.group(0)
        cleaned = matched_str.replace('$', '').replace(',', '')

        # trailing/leading zeros
        if re.fullmatch(r'\d+(\.\d+)?', cleaned):
            if '.' in cleaned:
                cleaned = str(float(cleaned)).rstrip('0').rstrip('.') 
            else:
                cleaned = str(int(cleaned)) 
        return cleaned

    number_pattern = r'\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$?\d+(?:\.\d+)?'
    text = re.sub(number_pattern, replace_number, text)

    text = re.sub(r'\b(\d{4})/(\d{2})/(\d{2})\b', r'\1\2\3', text)

    def replace_written_date(match):
        try:
            date_obj = datetime.strptime(match.group(0), '%B %d, %Y')
            return date_obj.strftime('%Y%m%d')
        except ValueError:
            return match.group(0)

    written_date_pattern = r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b'
    text = re.sub(written_date_pattern, replace_written_date, text, flags=re.IGNORECASE)

    def replace_percent(match):
        number = match.group(1)
        return number + ' __PERCENT__'

    percent_pattern = r'(\d+(?:\.\d+)?)%'
    text = re.sub(percent_pattern, replace_percent, text)

    return text

# adds commas to numbers to be dispalyed
def format_numbers(arr):
    formatted = []
    for s in arr:
        s = str(s);
        try:
            # Try to format as int if no decimal, else float
            if '.' in s:
                num = float(s.replace(",", ""))
                formatted_str = f"{num:,.2f}".rstrip('0').rstrip('.')  # keeps up to 2 decimals
            else:
                num = int(s.replace(",", ""))
                formatted_str = f"{num:,}"
            formatted.append(formatted_str)
        except ValueError:
            # If not a valid number, leave unchanged
            formatted.append(s)
    return formatted


# # cleans numbers in avr, removing commas, dollar signs, slashes fro dates
# def clean_pdf_text(text):

#     # remove dollar signs and commas from numbers
#     def replace_number(match):
#         return match.group(0).replace('$', '').replace(',', '')

#     number_pattern = r'\b\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\b'
#     text = re.sub(number_pattern, replace_number, text)

#     # remove slashes from dates (2023/12/31 -> 20231231)
#     text = re.sub(r'\b(\d{4})/(\d{2})/(\d{2})\b', r'\1\2\3', text)

#     return text
