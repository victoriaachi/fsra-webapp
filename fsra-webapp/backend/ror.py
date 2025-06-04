from flask import Blueprint, request, jsonify
import pandas as pd
from pandas.tseries.offsets import YearEnd, QuarterEnd
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

def has_data_beyond_col3(df):
    if df.shape[1] <= 3:
        return False

    subset = df.iloc[:, 3:]

    # Replace empty strings or strings with just spaces to NaN
    subset = subset.replace(r'^\s*$', pd.NA, regex=True)

    has_data = subset.notna().any().any()
    return has_data

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

def get_daily_date_range(file):
    xls = pd.ExcelFile(file)
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        if has_data_beyond_col3(df):
            continue

        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2]
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df = df.dropna(subset=['Date'])

        if not df.empty:
            min_dates.append(df['Date'].min())
            max_dates.append(df['Date'].max())

    if not min_dates or not max_dates:
        return None

    overall_min = min(min_dates)
    overall_max = max(max_dates)

    return overall_min, overall_max

def get_quarterly_date_range(file):
    xls = pd.ExcelFile(file)
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        if has_data_beyond_col3(df):
            continue

        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2]
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df = df.dropna().sort_values(by='Date')

        df['QuarterEnd'] = df['Date'] + QuarterEnd(0)
        last_per_quarter = df[df['Date'] <= df['QuarterEnd']].groupby('QuarterEnd').last().reset_index()

        if not last_per_quarter.empty:
            min_dates.append(last_per_quarter['QuarterEnd'].min())
            max_dates.append(last_per_quarter['QuarterEnd'].max())

    if not min_dates or not max_dates:
        return None

    overall_min = min(min_dates)
    overall_max = max(max_dates)

    return overall_min, overall_max


def get_annual_date_range(file):
    xls = pd.ExcelFile(file)
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        if has_data_beyond_col3(df):
            continue

        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2]
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df = df.dropna().sort_values(by='Date')

        df['YearEnd'] = df['Date'] + YearEnd(0)
        last_per_year = df[df['Date'] <= df['YearEnd']].groupby('YearEnd').last().reset_index()

        if not last_per_year.empty:
            min_dates.append(last_per_year['YearEnd'].min())
            max_dates.append(last_per_year['YearEnd'].max())

    if not min_dates or not max_dates:
        return None

    overall_min = min(min_dates)
    overall_max = max(max_dates)

    return overall_min, overall_max



def calculate_quarterly_ror(file):
    xls = pd.ExcelFile(file)
    result = {}

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        if has_data_beyond_col3(df):
            continue

        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2]
        df.columns = ['Date', 'Price']

        # Specify the date format here to avoid the warning
        df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
        df = df.dropna().sort_values(by='Date')

        # Step 1: Snap each date to the end of its quarter (but not past actual date)
        df['QuarterEnd'] = df['Date'] + QuarterEnd(0)

        # Step 2: For each quarter, keep the last available entry before or on quarter end
        last_per_quarter = df[df['Date'] <= df['QuarterEnd']].groupby('QuarterEnd').last().reset_index()

        # Step 3: Calculate ROR between quarters
        last_per_quarter['QuarterReturn'] = last_per_quarter['Price'].pct_change()
        last_per_quarter = last_per_quarter.dropna()

        result[sheet_name] = last_per_quarter[['QuarterEnd', 'QuarterReturn']].rename(
            columns={'QuarterEnd': 'Date'}).to_dict(orient='records')

    return result


def calculate_annual_ror(file):
    xls = pd.ExcelFile(file)
    result = {}

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
        if has_data_beyond_col3(df):
            continue

        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df = df.iloc[:, :2]
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
        df = df.dropna().sort_values(by='Date')

        # Step 1: Snap to calendar year end (but no future dates)
        df['YearEnd'] = df['Date'] + YearEnd(0)

        # Step 2: Keep last price before/on each year-end
        last_per_year = df[df['Date'] <= df['YearEnd']].groupby('YearEnd').last().reset_index()

        # Step 3: Calculate annual return
        last_per_year['AnnualReturn'] = last_per_year['Price'].pct_change()
        last_per_year = last_per_year.dropna()

        result[sheet_name] = last_per_year[['YearEnd', 'AnnualReturn']].rename(
            columns={'YearEnd': 'Date'}).to_dict(orient='records')

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
        quarterly = calculate_quarterly_ror(file)
        annual = calculate_annual_ror(file)
        daily_range = get_daily_date_range(file)
        quarter_range = get_quarterly_date_range(file)
        annual_range = get_annual_date_range(file)
        

        # Print it for debugging (convert to string so dates print nicely)
        print(json.dumps(quarterly, indent=2, default=str))
        print("quarter range:", quarter_range)

        xls = pd.ExcelFile(file)
        filtered_sheets = []
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet_name, header=None)
            if not has_data_beyond_col3(df):
                filtered_sheets.append(sheet_name)

        securities = filtered_sheets

        daily_range_str = {
            "min": daily_range[0].strftime('%Y-%m-%d') if daily_range else None,
            "max": daily_range[1].strftime('%Y-%m-%d') if daily_range else None
        }
        quarter_range_str = {
            "min": quarter_range[0].strftime('%Y-%m-%d') if quarter_range else None,
            "max": quarter_range[1].strftime('%Y-%m-%d') if quarter_range else None
        }
        annual_range_str = {
            "min": annual_range[0].strftime('%Y-%m-%d') if annual_range else None,
            "max": annual_range[1].strftime('%Y-%m-%d') if annual_range else None
        }

        return jsonify({
            "ranges": {
                "daily": daily_range_str,
                "quarter": quarter_range_str,
                "annual": annual_range_str
            },
            "securities": securities,
            "daily": daily,
            "quarter": quarterly,
            "annual": annual
            })

    except Exception as e:
        print("Error processing file:", e)
        return jsonify({"error": str(e)}), 500
