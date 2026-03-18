import sys
from PyPDF2 import PdfReader

try:
    reader = PdfReader("/tmp/biolinea_pdfs/BIOLINEA/11 NOVIEMBRE BIOLINEA 01F125002025.PDF")
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    with open("sample_pdf_text.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Success")
except Exception as e:
    print("Error:", e)
