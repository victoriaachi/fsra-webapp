input_filename = "titles.txt"
output_filename = "saved_titles.py"

# Read lines and clean them
with open(input_filename, "r") as f:
    titles = [line.strip() if line.strip() else '""' for line in f]

# Write the array into a new Python file
with open(output_filename, "w") as f:
    f.write("# This file was generated automatically\n")
    f.write("titles = [\n")
    for title in titles:
        # Wrap non-empty titles in quotes
        if title == '""':
            f.write('    "",\n')
        else:
            f.write(f'    "{title}",\n')
    f.write("]\n")

print(f"Array saved to {output_filename}")
