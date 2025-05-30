import re

def extract_num(s):
    result = None  # default result if no number found

    if s is not None:
        # Check if number is in parentheses -> treat as negative
        is_negative = False
        s = s.strip()
        if s.startswith('(') and s.endswith(')'):
            is_negative = True
            s = s[1:-1].strip()  # remove parentheses

        # Remove commas
        s = s.replace(',', '')
        s = s.replace('-', '')

        # Extract number with optional decimal and % sign
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


def num_equal(str1, str2, tol=1e-9):
    num1 = extract_num(str1)
    num2 = extract_num(str2)
    print(num_equal);
    print(num1);
    print(num2);
    
    if num1 is None or num2 is None:
        return False
    
    # Compare with a tolerance for floating point errors
    return abs(num1 - num2) < tol
