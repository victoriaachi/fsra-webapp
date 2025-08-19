import re
from datetime import datetime

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
def clean_numbers_pdf(text, dates_array):
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

    # numeric-style dates (YYYY/MM/DD → YYYYMMDD)
    def replace_numeric_date(match):
        cleaned = f"{match.group(1)}{match.group(2)}{match.group(3)}"
        if cleaned not in dates_array:
            dates_array.append(cleaned)
        return cleaned

    numeric_date_pattern = r'\b(\d{4})/(\d{2})/(\d{2})\b'
    text = re.sub(numeric_date_pattern, replace_numeric_date, text)

    # written-style dates (e.g. January 18, 2025 → 20250118)
    def replace_written_date(match):
        try:
            date_obj = datetime.strptime(match.group(0), '%B %d, %Y')
            cleaned = date_obj.strftime('%Y%m%d')
            if cleaned not in dates_array:
                dates_array.append(cleaned)
            return cleaned
        except ValueError:
            return match.group(0)

    written_date_pattern = r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b'
    text = re.sub(written_date_pattern, replace_written_date, text, flags=re.IGNORECASE)

    # percents
    def replace_percent(match):
        number = match.group(1)
        return number
        # return number + ' __PERCENT__'

    percent_pattern = r'(\d+(?:\.\d+)?)%'
    text = re.sub(percent_pattern, replace_percent, text)

    return text

# adds commas to numbers to be displayed
def format_numbers(arr):
    formatted = []
    for s in arr:
        s = str(s);
        try:
            if '.' in s:
                num = float(s.replace(",", ""))
                formatted_str = f"{num:,.2f}".rstrip('0').rstrip('.')  # keeps up to 2 decimals
            else:
                num = int(s.replace(",", ""))
                formatted_str = f"{num:,}"
            formatted.append(formatted_str)
        except ValueError:
            formatted.append(s)
    return formatted
