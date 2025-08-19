from rapidfuzz import fuzz
import re
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

# finds the number of years in between start and end dates
def find_period(start_str, end_str):
    start_date = datetime.strptime(start_str, "%Y%m%d")
    end_date = datetime.strptime(end_str, "%Y%m%d")

    days_diff = (end_date - start_date).days
    years = days_diff / 365.25

    return round(years)

# finds sums in avr values
def extract_sum(text, match_start, match_end, window):
    start = max(0, match_start - window)
    end = min(len(text), match_end + window)
    window_text = text[start:end]
    tokens = re.findall(r'[^\s]+', window_text)  
    numbers = []
    for token in tokens:
        try:
            num = extract_num(token)
            if num is not None:
                numbers.append(num)
        except:
            continue
    return numbers


# removes non-numbers from a string
def extract_num(s):
    result = None  

    if s is not None:

        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s):
            return int(s.replace('-', ''))

        # check if negative
        is_negative = False
        s = s.strip()
        if s.startswith('(') and s.endswith(')'):
            is_negative = True
            s = s[1:-1].strip()  

        # remove commas
        s = s.replace(',', '')

        # decimals and %
        match = re.search(r'([-+]?\d*\.?\d+)%?', s)
        if match:
            num_str = match.group(0)
            if num_str.endswith('%'):
                val = float(num_str[:-1]) / 100
            else:
                val = float(num_str)

            if is_negative:
                val = -val

            result = val

    return result

# creates variants for percentages, rounding, etc
def avr_match_dec(val, is_percent=False):
    variants = []
    try:
        num = float(val)
    except:
        return variants
    variants.append(val)
    variants.append(f"{num:.2f}")            
    variants.append(f"{round(num, 1):.1f}") 

    dec_val = Decimal(str(num))
    quantized_val = dec_val.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    variants.append(str(quantized_val)) 

    if is_percent:
        variants.append(f"{round(num * 100, 1):.1f}")  # percentage version
    print(variants)

    return variants