from flask import Blueprint, request, jsonify
import pandas as pd
from pandas.tseries.offsets import YearEnd, QuarterEnd, MonthEnd
import json, psutil, os, gc

ror_bp = Blueprint('ror', __name__)
process = psutil.Process(os.getpid())

def find_data_start(df):
    for i, row in df.iterrows():
        try:
            pd.to_datetime(row[0])
            return i
        except (ValueError, TypeError):
            continue
    return None

def read_and_clean_sheet(xls, sheet_name):
    if sheet_name.strip().lower() in ("since last update", "ror"):
        return None

    df = pd.read_excel(xls, sheet_name=sheet_name, usecols=[0,1], header=None)
    start_row = find_data_start(df)
    if start_row is None:
        return None

    df = df.iloc[start_row:].reset_index(drop=True)
    df.columns = ['Date', 'Price']

    df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
    df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
    df = df.dropna().sort_values(by='Date')

    # If it's a Bloomberg-style sheet, shift price forward
    if sheet_name.strip().upper().startswith("BB"):
        df = df.copy()
        df['Price'] = df['Price'].shift(-1)
        return df.dropna(subset=['Price'])

    return df

def calculate_daily_ror(xls):
    result = {}

    for sheet_name in xls.sheet_names:
        df = read_and_clean_sheet(xls, sheet_name)
        if df is None:
            continue

        df['DailyReturn'] = df['Price'].pct_change()
        df = df.dropna()

        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        result[sheet_name] = df[['Date', 'Price', 'DailyReturn']].to_dict(orient='records')

    return result


def calculate_monthly_ror(xls):
    result = {}

    for sheet_name in xls.sheet_names:
        df = read_and_clean_sheet(xls, sheet_name)
        if df is None:
            continue

        df['MonthEnd'] = df['Date'] + MonthEnd(0)
        last_per_month = df[df['Date'] <= df['MonthEnd']].groupby('MonthEnd').last().reset_index()
        last_per_month['MonthlyReturn'] = last_per_month['Price'].pct_change()
        last_per_month = last_per_month.dropna()

        last_per_month['MonthEnd'] = last_per_month['MonthEnd'].dt.strftime('%Y-%m-%d')
        result[sheet_name] = last_per_month[['MonthEnd', 'Price', 'MonthlyReturn']].rename(
            columns={'MonthEnd': 'Date'}).to_dict(orient='records')

    return result


def calculate_quarterly_ror(xls):
    result = {}

    for sheet_name in xls.sheet_names:
        df = read_and_clean_sheet(xls, sheet_name)
        if df is None:
            continue

        df['QuarterEnd'] = df['Date'] + QuarterEnd(0)
        last_per_quarter = df[df['Date'] <= df['QuarterEnd']].groupby('QuarterEnd').last().reset_index()
        last_per_quarter['QuarterReturn'] = last_per_quarter['Price'].pct_change()
        last_per_quarter = last_per_quarter.dropna()

        last_per_quarter['QuarterEnd'] = last_per_quarter['QuarterEnd'].dt.strftime('%Y-%m-%d')
        result[sheet_name] = last_per_quarter[['QuarterEnd', 'Price', 'QuarterReturn']].rename(
            columns={'QuarterEnd': 'Date'}).to_dict(orient='records')

    return result


def calculate_annual_ror(xls):
    result = {}

    for sheet_name in xls.sheet_names:
        df = read_and_clean_sheet(xls, sheet_name)
        if df is None:
            continue

        df['YearEnd'] = df['Date'] + YearEnd(0)
        last_per_year = df[df['Date'] <= df['YearEnd']].groupby('YearEnd').last().reset_index()
        last_per_year['AnnualReturn'] = last_per_year['Price'].pct_change()
        last_per_year = last_per_year.dropna()

        last_per_year['YearEnd'] = last_per_year['YearEnd'].dt.strftime('%Y-%m-%d')
        result[sheet_name] = last_per_year[['YearEnd', 'Price', 'AnnualReturn']].rename(
            columns={'YearEnd': 'Date'}).to_dict(orient='records')

    return result


def extract_raw_prices(xls):
    result = {}

    for sheet_name in xls.sheet_names:
        df = read_and_clean_sheet(xls, sheet_name)
        if df is None:
            continue

        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        result[sheet_name] = df[['Date', 'Price']].to_dict(orient='records')

    return result


def get_monthly_date_range(xls):
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        if sheet_name.strip().lower() in ("since last update", "ror"):
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name, usecols=[0,1], header=None)
        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
        df = df.dropna().sort_values(by='Date')

        df['MonthEnd'] = df['Date'] + MonthEnd(0)
        last_per_month = df[df['Date'] <= df['MonthEnd']].groupby('MonthEnd').last().reset_index()

        if not last_per_month.empty:
            min_dates.append(last_per_month['MonthEnd'].min())
            max_dates.append(last_per_month['MonthEnd'].max())

    if not min_dates or not max_dates:
        return None

    return min(min_dates), max(max_dates)

def get_daily_date_range(xls):
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        if sheet_name.strip().lower() in ("since last update", "ror"):
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name, usecols=[0,1], header=None)
        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
        df = df.dropna(subset=['Date'])

        if not df.empty:
            min_dates.append(df['Date'].min())
            max_dates.append(df['Date'].max())

    if not min_dates or not max_dates:
        return None

    overall_min = min(min_dates)
    overall_max = max(max_dates)

    return overall_min, overall_max

def get_quarterly_date_range(xls):
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        if sheet_name.strip().lower() in ("since last update", "ror"):
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name, usecols=[0,1], header=None)
        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
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

def get_annual_date_range(xls):
    min_dates = []
    max_dates = []

    for sheet_name in xls.sheet_names:
        if sheet_name.strip().lower() in ("since last update", "ror"):
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name, usecols=[0,1], header=None)
        start_row = find_data_start(df)
        if start_row is None:
            continue

        df = df.iloc[start_row:].reset_index(drop=True)
        df.columns = ['Date', 'Price']

        df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y', errors='coerce')
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

def rename_keys(data_dict, rename_map):
    renamed = {}
    for old_key, value in data_dict.items():
        new_key = rename_map.get(old_key, old_key)  # Use new name if exists, else original
        renamed[new_key] = value
    return renamed



@ror_bp.route('/ror', methods=['POST'])
def ror():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    try:
        print(f"[Memory before processing] {process.memory_info().rss / 1024**2:.2f} MB")

        xls = pd.ExcelFile(file)  # Load once here

        daily = calculate_daily_ror(xls)
        gc.collect()
        print(f"[Memory after calculate_daily_ror] {process.memory_info().rss / 1024**2:.2f} MB")

        monthly = calculate_monthly_ror(xls)
        gc.collect()
        print(f"[Memory after calculate_monthly_ror] {process.memory_info().rss / 1024**2:.2f} MB")

        quarterly = calculate_quarterly_ror(xls)
        gc.collect()
        print(f"[Memory after calculate_quarterly_ror] {process.memory_info().rss / 1024**2:.2f} MB")

        annual = calculate_annual_ror(xls)
        gc.collect()
        print(f"[Memory after calculate_annual_ror] {process.memory_info().rss / 1024**2:.2f} MB")

        daily_range = get_daily_date_range(xls)
        gc.collect()
        print(f"[Memory after get_daily_date_range] {process.memory_info().rss / 1024**2:.2f} MB")

        monthly_range = get_monthly_date_range(xls)
        gc.collect()
        print(f"[Memory after get_monthly_date_range] {process.memory_info().rss / 1024**2:.2f} MB")

        quarter_range = get_quarterly_date_range(xls)
        gc.collect()
        print(f"[Memory after get_quarterly_date_range] {process.memory_info().rss / 1024**2:.2f} MB")

        annual_range = get_annual_date_range(xls)
        gc.collect()
        print(f"[Memory after get_annual_date_range] {process.memory_info().rss / 1024**2:.2f} MB")

        raw_prices = extract_raw_prices(xls)
        gc.collect()
        print(f"[Memory after extract_raw_prices] {process.memory_info().rss / 1024**2:.2f} MB")

        filtered_sheets = [sheet_name for sheet_name in xls.sheet_names
                           if sheet_name.strip().lower() not in ("since last update", "ror")]

        securities = filtered_sheets

        daily_range_str = {
            "min": daily_range[0].strftime('%Y-%m-%d') if daily_range else None,
            "max": daily_range[1].strftime('%Y-%m-%d') if daily_range else None
        }
        monthly_range_str = {
            "min": monthly_range[0].strftime('%Y-%m-%d') if monthly_range else None,
            "max": monthly_range[1].strftime('%Y-%m-%d') if monthly_range else None
        }
        quarter_range_str = {
            "min": quarter_range[0].strftime('%Y-%m-%d') if quarter_range else None,
            "max": quarter_range[1].strftime('%Y-%m-%d') if quarter_range else None
        }
        annual_range_str = {
            "min": annual_range[0].strftime('%Y-%m-%d') if annual_range else None,
            "max": annual_range[1].strftime('%Y-%m-%d') if annual_range else None
        }

        debug_output = {
            "daily": {k: v[:5] for k, v in list(daily.items())[:5]},
            "monthly": {k: v[:5] for k, v in list(monthly.items())[:5]},
            "quarter": {k: v[:5] for k, v in list(quarterly.items())[:5]},
            "annual": {k: v[:5] for k, v in list(annual.items())[:5]},
            "rawPrices": {k: v[:5] for k, v in list(raw_prices.items())[:5]}
        }

        rename_map = {
            "S&P_TSX Composite Index (Net TR": "S&P/TSX",
            "MSCI World daily": "MSCI World",
        }

        daily = rename_keys(daily, rename_map)
        monthly = rename_keys(monthly, rename_map)
        quarter = rename_keys(quarterly, rename_map)
        annual = rename_keys(annual, rename_map)
        raw_prices = rename_keys(raw_prices, rename_map)

        securities = [rename_map.get(s, s) for s in filtered_sheets]
        # print("=== DEBUG: First 5 entries of each section ===")
        # print(json.dumps(debug_output, indent=2, default=str))
        gc.collect()
        print(f"[Memory before returning response] {process.memory_info().rss / 1024**2:.2f} MB")

        return jsonify({
            "ranges": {
                "daily": daily_range_str,
                "monthly": monthly_range_str,
                "quarter": quarter_range_str,
                "annual": annual_range_str
            },
            "securities": securities,
            "daily": daily,
            "quarter": quarterly,
            "monthly": monthly,
            "annual": annual,
            "rawPrices": raw_prices
            })

    except Exception as e:
        print("Error processing file:", e)
        return jsonify({"error": str(e)}), 500
