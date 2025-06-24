from rapidfuzz import fuzz
import re
from decimal import Decimal, ROUND_HALF_UP

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
# # only for number matching currently
# def find_nearest_word(text, keyword, threshold=100):
#     words = re.findall(r'\S+', text)
    
#     best_word = None
#     best_score = 0

#     keyword_lower = keyword.lower()

#     for word in words:
#         word_lower = word.lower()
#         score = fuzz.ratio(keyword_lower, word_lower)
#         if score > best_score:
#             best_score = score
#             best_word = word

#     if best_score >= threshold:
#         return best_word, best_score
#     else:
#         return None, 0


# def find_nearest_number(text, keyword, threshold=100, decimals=None):
#     import re
#     from rapidfuzz import fuzz

#     try:
#         keyword_num = float(keyword)
#         if decimals is not None:
#             keyword_num = round(keyword_num, decimals)
#     except ValueError:
#         return None, 0
    
#     if text is None:
#         return None, 0

#     numbers_in_text = re.findall(r'\d+(?:\.\d+)?', text)

#     best_match = None
#     best_score = 0

#     for num_str in numbers_in_text:
#         try:
#             text_num = float(num_str)
#             if decimals is not None:
#                 text_num = round(text_num, decimals)
#         except ValueError:
#             continue

#         score = fuzz.ratio(str(keyword_num), str(text_num))
#         if score > best_score:
#             best_score = score
#             best_match = num_str

#     if best_score >= threshold:
#         return best_match, best_score
#     return None, 0




# def find_sentence(text, keyword, title, threshold=100, decimals=None, fuzz_threshold=80):
#     """
#     Looks for a sentence that contains a number matching 'keyword',
#     and also contains or fuzzily matches the 'title'.

#     Parameters:
#         - text: The entire AVR text
#         - keyword: The number you're trying to find
#         - title: The field name you're trying to match contextually
#         - threshold: Numeric matching threshold (should be 100 for exact match)
#         - decimals: Optional, how many decimal places to normalize numbers to
#         - fuzz_threshold: Fuzzy text threshold for matching title in sentence
#     """
#     # Step 1: Find the number (strict match)
#     match, number_score = find_nearest_number(text, keyword, threshold=threshold, decimals=decimals)
#     if not match:
#         return None, 0, None  # No number match found

#     # Step 2: Split text into sentences or lines
#     sentences = re.split(r'(?<=[\.\n])\s+', text)

#     # Step 3: Search for sentence with both the number and good fuzzy title match
#     for i, sentence in enumerate(sentences):
#         if str(match) in sentence:
#             # Combine this sentence with previous and next ones for context
#             start = max(i - 5, 0)  # 1 sentence before  i-N, i+N+1
#             end = min(i + 6, len(sentences))  # 1 sentence after (exclusive)
#             combined = ' '.join(sentences[start:end]).strip()

#             fuzz_score = fuzz.partial_ratio(title.lower(), combined.lower())
#             if title.lower() in combined.lower() or fuzz_score >= fuzz_threshold:
#                 return combined, fuzz_score, match

#     # Step 4: Number matched, but no sentence with good title
#     return None, 0, match

# def find_sentence(text, keyword, title, threshold=100, decimals=None, fuzz_threshold=80):
#     """
#     Looks for a sentence that contains a number matching 'keyword',
#     and also contains or fuzzily matches the 'title'.
#     """
#     # First get the best matching number in the text
#     match, score = find_nearest_number(text, keyword, threshold=threshold, decimals=decimals)
#     if not match:
#         return None, 0, None  # No match found

#     # Split text into sentences or lines
#     sentences = re.split(r'(?<=[\.\n])\s+', text)
    
#     for sentence in sentences:
#         if str(match) in sentence:
#             # Check if the title is contextually close to the sentence
#             fuzz_score = fuzz.partial_ratio(title.lower(), sentence.lower())
#             if title.lower() in sentence.lower() or fuzz_score >= fuzz_threshold:
#                 return sentence.strip(), fuzz_score, match  # return the sentence, score, and number match

#     return None, 0, match  # found number, but no sentence with good title match


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
