import re

def clean_text(text):
    # Remove lines with mostly non-words
    lines = text.split("\n")
    lines = [line for line in lines if re.search(r'\w', line) and not re.match(r'^\W+$', line)]
    return "\n".join(lines)