from rapidfuzz import fuzz
import re
from decimal import Decimal, ROUND_HALF_UP


# def find_nearby_chunk(text, keyword, window=2, threshold=70):
#     lines = text.splitlines()
#     best_match = None
#     best_score = 0
#     best_index = -1

#     for i, line in enumerate(lines):
#         score = fuzz.partial_ratio(keyword.lower(), line.lower())
#         if score > best_score:
#             best_score = score
#             best_match = line
#             best_index = i

#     if best_score >= threshold:
#         start = max(0, best_index - window)
#         end = min(len(lines), best_index + window + 1)
#         return "\n".join(lines[start:end]), best_score
#     return None, 0


# only for number matching currently
def find_nearest_word(text, keyword, threshold=100):
    # Split raw text into words by whitespace (keeps punctuation as part of words)
    words = re.findall(r'\S+', text)
    
    best_word = None
    best_score = 0

    # Lowercase for case-insensitive comparison
    keyword_lower = keyword.lower()

    for word in words:
        word_lower = word.lower()
        score = fuzz.ratio(keyword_lower, word_lower)
        if score > best_score:
            best_score = score
            best_word = word

    if best_score >= threshold:
        return best_word, best_score
    else:
        return None, 0

def find_nearest_number(text, keyword, threshold=100, decimals=None):
    import re
    from rapidfuzz import fuzz

    try:
        keyword_num = float(keyword)
        if decimals is not None:
            keyword_num = round(keyword_num, decimals)
    except ValueError:
        return None, 0
    
    if text is None:
        return None, 0

    numbers_in_text = re.findall(r'\d+(?:\.\d+)?', text)

    best_match = None
    best_score = 0

    for num_str in numbers_in_text:
        try:
            text_num = float(num_str)
            if decimals is not None:
                text_num = round(text_num, decimals)
        except ValueError:
            continue

        score = fuzz.ratio(str(keyword_num), str(text_num))
        if score > best_score:
            best_score = score
            best_match = num_str

    if best_score >= threshold:
        return best_match, best_score
    return None, 0


# def avr_match_dec(val):
#     """
#     Given a decimal string from AIS (e.g. '1.07'), return all possible AVR representations,
#     including percent with '__PERCENT__'.
#     """
#     variants = [val]
#     try:
#         num = float(val)
#         multiplied = str(round(num * 100, 6)).rstrip('0').rstrip('.')
#         variants.append(multiplied)
#         variants.append(multiplied + ' __PERCENT__')
#     except ValueError:
#         pass
#     return variants

def avr_match_dec(val, is_percent=False):
    variants = []
    try:
        num = float(val)
    except:
        return variants

    variants.append(f"{num:.2f}")            # original with 2 decimals
    variants.append(f"{round(num, 1):.1f}")  # rounded with built-in round, converted to string with 1 decimal

    # If num is a float, convert it to Decimal first
    dec_val = Decimal(str(num))

    # Use Decimal quantize for rounding
    quantized_val = dec_val.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    variants.append(str(quantized_val)) 

    if is_percent:
        variants.append(f"{round(num * 100, 1):.1f}")  # percentage version
    print(variants)

    return variants

