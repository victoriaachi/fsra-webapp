from flask import Blueprint, request, jsonify
import pandas as pd
import json

ror_bp = Blueprint('ror', __name__)

def find_data_start(df):
    for i, row in df.iterrows():
        try:
            pd.to_datetime(row[0])
            return i
        except (ValueError, TypeError):
            continue
    return None

def calculate_daily_ror(file):
    xls = pd.ExcelFile(file)
    result = {}

    for sheet_name in xls.sheet_names:
        #sheet_name = xls.sheet_names[0]
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2] 
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
        df = df.dropna()

        df = df.sort_values(by='Date')
        df['DailyReturn'] = df['Price'].pct_change()
        df = df.dropna()

        result[sheet_name] = df[['Date', 'DailyReturn']].to_dict(orient='records')

    return result

@ror_bp.route('/ror', methods=['POST'])
def ror():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        daily = calculate_daily_ror(file)

        # Print it for debugging (convert to string so dates print nicely)
        print(json.dumps(daily, indent=2, default=str))

        return jsonify({
            "daily": daily
            "quarterly": quarterly
            "annually": annually 
            })

    except Exception as e:
        print("Error processing file:", e)
        return jsonify({"error": str(e)}), 500
