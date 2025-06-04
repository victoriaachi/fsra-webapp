import requests
from doc2docx import convert
from docx import Document
import os

LAST_MODIFIED_FILE = "./last_modified.txt"

def get_remote_last_modified(url, headers):
    response = requests.head(url, headers=headers)
    if response.status_code == 200:
        return response.headers.get("Last-Modified")
    else:
        raise Exception(f"HEAD request failed with status {response.status_code}")

def read_local_last_modified():
    if os.path.exists(LAST_MODIFIED_FILE):
        with open(LAST_MODIFIED_FILE, "r") as f:
            return f.read().strip()
    return None

def write_local_last_modified(timestamp):
    with open(LAST_MODIFIED_FILE, "w") as f:
        f.write(timestamp)

def download_doc_file_if_updated(doc_url, doc_path, headers):
    remote_last_modified = get_remote_last_modified(doc_url, headers)
    local_last_modified = read_local_last_modified()

    if remote_last_modified != local_last_modified:
        print(f"Remote file changed (or first download). Downloading...")
        response = requests.get(doc_url, headers=headers)
        if response.status_code == 200:
            with open(doc_path, "wb") as f:
                f.write(response.content)
            write_local_last_modified(remote_last_modified)
            return True  # file updated
        else:
            raise Exception(f"Failed to download DOC file: {response.status_code}")
    else:
        print("File not changed, using existing .doc file.")
        return False  # file not updated

def get_pba_docx():
    doc_url = "https://www.ontario.ca/laws/docs/90p08_e.doc"
    doc_path = "./pba.doc"
    docx_path = "./pba.docx"

    headers = {
        "Referer": "https://www.ontario.ca/laws/statute/90p08",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"'
    }

    file_updated = download_doc_file_if_updated(doc_url, doc_path, headers)

    if file_updated or not os.path.exists(docx_path):
        print("Converting DOC to DOCX...")
        convert(doc_path)  # This saves ./pba.docx
        if not os.path.exists(docx_path):
            raise FileNotFoundError("Conversion failed, .docx file not found.")
        print("Conversion done.")
    else:
        print("Using existing DOCX file.")

    # Extract text from docx (whether newly converted or reused)
    doc = Document(docx_path)
    return doc

def get_pba_text():
    doc = get_pba_docx()
    pba_text = "\n".join([para.text for para in doc.paragraphs])
