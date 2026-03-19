# Textbook Image Extraction Design

This document specifies the design for a system to extract images from medical textbook PDFs, saving them locally with rich metadata.

## 1. Goal
Extract all high-quality images from "First Aid for the USMLE Step 1 2023" and "Pathoma 2021" PDFs, preserving their chapter context and saving them as PNG files with a structured metadata index.

## 2. Components

### 2.1 Storage Structure
- **Root Directory:** `extracted_images/`
- **Sub-directories:**
  - `images/`: Stores all extracted `.png` files.
- **Index File:** `metadata.json`: A central registry for all images.

### 2.2 Extraction Engine
- **Library:** `PyMuPDF` (`fitz`) for layout-aware PDF parsing.
- **Filtering:** Minimum resolution threshold (e.g., 50x50 pixels) to exclude UI icons and artifacts.
- **Deduplication:** Basic MD5 hashing of image bytes to prevent redundant extraction across multiple books or pages.

### 2.3 Metadata Schema
Each image entry in `metadata.json` will contain:
- `image_id`: Unique string (e.g., `md5hash`).
- `filename`: Local filename in `images/` (e.g., `md5hash.png`).
- `source_book`: Name of the source PDF.
- `chapter`: Current chapter name (extracted from PDF bookmarks/outline).
- `page_number`: 1-indexed page number in the PDF.
- `caption_candidate`: Nearest text block to the image (heuristic-based).
- `timestamp`: Extraction date/time.

## 3. Data Flow
1. **Load Book:** Open the target PDF and load its hierarchical TOC (outline).
2. **Iterate Pages:** Traverse each page in the document.
3. **Resolve Chapter:** Match the current page number against the TOC ranges to identify the chapter.
4. **Extract Images:** Identify image objects on the page.
5. **Heuristic Captioning:** Look for the nearest text blocks (above or below) to the image's bounding box.
6. **Save Image:** Save the image data as a PNG if it meets size/uniqueness criteria.
7. **Append Metadata:** Update the global `metadata.json` list.

## 4. Implementation Details
A script `extract_images.py` will be the primary entry point.

```python
import fitz # PyMuPDF
import json
import os
import hashlib

def get_chapter_name(page_num, toc):
    # Heuristic to find chapter from TOC ranges
    pass

def extract_from_pdf(pdf_path, output_dir):
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()
    # Logic to process pages, extract images, and save to output_dir
```
