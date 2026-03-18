import sys
import os
import re
import json
from PyPDF2 import PdfReader

folder_path = "/tmp/biolinea_pdfs/BIOLINEA/"
articles = []
seen_refs = set()

for filename in os.listdir(folder_path):
    if filename.endswith(".PDF") or filename.endswith(".pdf"):
        try:
            reader = PdfReader(os.path.join(folder_path, filename))
            for page in reader.pages:
                text = page.extract_text()
                for line in text.split('\n'):
                    line = line.strip()
                    # Try to match: Desc Qty Price Subtotal Ref
                    # e.g. ESCOBILLON AMIES PS+VISCOSA C/100 5 35,13 175,65 AUL300287NEW
                    match = re.search(r'^(.*?)\s+(\d+)\s+(\d+,\d{2})\s+(\d+,\d{2})\s+([A-Z0-9\.\-]+)$', line)
                    if match:
                        name = match.group(1).strip()
                        qty = match.group(2)
                        price = match.group(3) + " €"
                        ref = match.group(5)
                        
                        # Sometimes name might be wrong, but let's assume it's good
                        if ref not in seen_refs:
                            seen_refs.add(ref)
                            articles.append({
                                "id": f"ART-NEW-{len(articles)+1}",
                                "name": name,
                                "category": "General",
                                "supplierName": "BIOLINEA",
                                "supplierRef": ref,
                                "price": price,
                                "stock": 0,
                                "minStock": 5
                            })
        except Exception as e:
            continue

with open("imported_articles.json", "w", encoding="utf-8") as f:
    json.dump(articles, f, indent=2, ensure_ascii=False)
print(f"Extracted {len(articles)} unique articles.")
