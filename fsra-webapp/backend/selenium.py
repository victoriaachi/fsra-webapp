from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time
import os

# 1. Configure download directory
download_dir = os.path.abspath("downloads")

if not os.path.exists(download_dir):
    os.makedirs(download_dir)

# 2. Set Chrome options to auto-download files
chrome_options = Options()
prefs = {
    "download.default_directory": download_dir,  # Set download folder
    "download.prompt_for_download": False,       # Disable download prompt
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
}
chrome_options.add_experimental_option("prefs", prefs)

# 3. Initialize the Chrome driver
service = Service(executable_path="path/to/chromedriver")  # <-- Change this path
driver = webdriver.Chrome(service=service, options=chrome_options)

try:
    # 4. Open the dynamic website
    driver.get("https://www.ontario.ca/laws/statute/90p08#act-verion")  # <-- Replace with the actual URL

    time.sleep(5)  # Wait for page to fully load (adjust if needed)

    # 5. Locate the download button/link for the Word document
    # For example, find by link text, xpath, id, or css selector
    download_button = driver.find_element(By.XPATH, "//a[contains(@href, '.docx')]")
    # or By.LINK_TEXT, By.CSS_SELECTOR, etc. depending on the site

    # 6. Click the download button to start downloading
    download_button.click()

    # 7. Wait for the download to complete
    # This is a simple wait; you can improve by checking the file existence or .crdownload
    time.sleep(10)

finally:
    driver.quit()
