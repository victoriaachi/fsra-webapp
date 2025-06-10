import re
from datetime import datetime


def clean_text(text):
    # Remove lines with mostly non-words
    lines = text.split("\n")
    lines = [line for line in lines if re.search(r'\w', line) and not re.match(r'^\W+$', line)]
    return "\n".join(lines)

def clean_numbers_ais(text):
    def remove_commas(match):
        return match.group(0).replace(',', '')

    # Remove commas from large numbers
    comma_pattern = r'\d{1,3}(?:,\d{3})+(?:\.\d+)?'
    text = re.sub(comma_pattern, remove_commas, text)

    # Remove dashes from ISO-style dates (e.g. 2024-01-01 -> 20240101)
    iso_date_pattern = r'\b(\d{4})-(\d{2})-(\d{2})\b'
    text = re.sub(iso_date_pattern, r'\1\2\3', text)

    return text

def clean_numbers_avr(text):
    """
    Removes commas and dollar signs from numbers, and removes slashes from dates.
    """

    def replace_number(match):
        matched_str = match.group(0)
        cleaned = matched_str.replace('$', '').replace(',', '')
        return cleaned

    # This pattern *includes* the dollar sign in the match
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
    text = re.sub(written_date_pattern, replace_written_date, text)

    def replace_percent(match):
        number = match.group(1)
        return number + ' __PERCENT__'

    percent_pattern = r'(\d+(?:\.\d+)?)%'
    text = re.sub(percent_pattern, replace_percent, text)

    return text