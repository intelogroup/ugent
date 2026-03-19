# Textbook Image Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract high-quality images from medical textbooks as PNGs with rich metadata (book, chapter, page, caption, timestamp).

**Architecture:** Use `PyMuPDF` for layout parsing, TOC-based chapter resolution, heuristic caption detection, and a centralized `metadata.json` index with robust append/deduplication logic.

**Tech Stack:** Python, `PyMuPDF` (`fitz`), `pytest`.

---

### Task 1: Setup Output Structure and Dependencies

**Files:**
- Modify: `requirements.txt`
- Create: `extracted_images/images/.gitkeep`

- [ ] **Step 1: Update requirements.txt**
Ensure `PyMuPDF` is included.

```text
pymupdf
pinecone
python-dotenv
pytest
```

- [ ] **Step 2: Install updated dependencies**
Run: `pip install -r requirements.txt`

- [ ] **Step 3: Create directory structure**
Run: `mkdir -p extracted_images/images`

- [ ] **Step 4: Commit**
```bash
git add requirements.txt extracted_images/
git commit -m "chore: setup image extraction directory and dependencies"
```

---

### Task 2: Implement Chapter Resolver Utility

**Files:**
- Create: `chapter_resolver.py`
- Test: `test_chapter_resolver.py`

- [ ] **Step 1: Write tests for chapter resolution**
Create `test_chapter_resolver.py` with mock TOC data.

```python
from chapter_resolver import get_chapter_from_toc

def test_get_chapter_from_toc():
    # TOC format: [level, title, page_num]
    toc = [
        [1, "Chapter 1: Intro", 1],
        [1, "Chapter 2: Heart", 10],
        [2, "Section 2.1", 12]
    ]
    assert get_chapter_from_toc(1, toc) == "Chapter 1: Intro"
    assert get_chapter_from_toc(5, toc) == "Chapter 1: Intro"
    assert get_chapter_from_toc(10, toc) == "Chapter 2: Heart"
    assert get_chapter_from_toc(12, toc) == "Chapter 2: Heart" # Inherit parent
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest test_chapter_resolver.py`
Expected: FAIL.

- [ ] **Step 3: Implement chapter_resolver.py**

```python
def get_chapter_from_toc(page_num, toc):
    current_chapter = "Unknown"
    for level, title, start_page in toc:
        if level == 1:
            if start_page <= page_num:
                current_chapter = title
            else:
                break
    return current_chapter
```

- [ ] **Step 4: Run tests**
Run: `pytest test_chapter_resolver.py`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add chapter_resolver.py test_chapter_resolver.py
git commit -m "feat: implement TOC-based chapter resolver"
```

---

### Task 3: Implement Image Extractor with Caption Heuristic

**Files:**
- Create: `extract_images.py`
- Test: `test_extract_images.py`

- [ ] **Step 1: Implement find_caption and core extraction in extract_images.py**
Includes logic to handle existing metadata and prevent duplicate entries.

```python
import fitz
import os
import hashlib
import json
from datetime import datetime
from chapter_resolver import get_chapter_from_toc

def find_caption(page, img_rect, threshold=50):
    blocks = page.get_text("blocks")
    closest_text = ""
    min_dist = float('inf')
    
    for b in blocks:
        if b[6] == 0: # text block
            block_rect = fitz.Rect(b[:4])
            dist_below = abs(block_rect.y0 - img_rect.y1)
            dist_above = abs(block_rect.y1 - img_rect.y0)
            
            curr_min = min(dist_below, dist_above)
            if curr_min < min_dist and curr_min < threshold:
                min_dist = curr_min
                closest_text = b[4].strip()
                
    return closest_text

def extract_images(pdf_path, output_root="extracted_images"):
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()
    img_dir = os.path.join(output_root, "images")
    metadata_path = os.path.join(output_root, "metadata.json")
    os.makedirs(img_dir, exist_ok=True)
    
    # Load existing metadata to prevent duplicates
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
    else:
        metadata = []
    
    existing_ids = {m["image_id"] for m in metadata}
    new_entries = []
    
    for page_index in range(len(doc)):
        page = doc[page_index]
        page_num = page_index + 1
        chapter = get_chapter_from_toc(page_num, toc)
        
        for img_info in page.get_image_info():
            xref = img_info["xref"]
            if xref == 0: continue
            
            img_rect = fitz.Rect(img_info["bbox"])
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            
            if base_image["width"] < 50 or base_image["height"] < 50:
                continue
                
            img_hash = hashlib.md5(image_bytes).hexdigest()
            filename = f"{img_hash}.png"
            filepath = os.path.join(img_dir, filename)
            
            if not os.path.exists(filepath):
                with open(filepath, "wb") as f:
                    f.write(image_bytes)
            
            if img_hash not in existing_ids:
                caption = find_caption(page, img_rect)
                entry = {
                    "image_id": img_hash,
                    "filename": filename,
                    "source_book": os.path.basename(pdf_path),
                    "chapter": chapter,
                    "page_number": page_num,
                    "caption_candidate": caption,
                    "timestamp": datetime.now().isoformat()
                }
                metadata.append(entry)
                new_entries.append(entry)
                existing_ids.add(img_hash)
    
    # Atomic write
    temp_path = metadata_path + ".tmp"
    with open(temp_path, "w") as f:
        json.dump(metadata, f, indent=2)
    os.replace(temp_path, metadata_path)
            
    return new_entries

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        new = extract_images(sys.argv[1])
        print(f"Extracted {len(new)} new images from {sys.argv[1]}")
```

- [ ] **Step 2: Write comprehensive tests for extraction**
Create `test_extract_images.py` with mocks for `fitz`.

```python
from unittest.mock import MagicMock, patch
import os
import json
from extract_images import extract_images

@patch("extract_images.fitz.open")
def test_extract_images_basic(mock_open, tmp_path):
    # Mock Document and Page
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_open.return_value = mock_doc
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    mock_doc.get_toc.return_value = [[1, "Chapter 1", 1]]
    
    # Mock Image Info
    mock_page.get_image_info.return_value = [{"xref": 10, "bbox": (0,0,100,100)}]
    mock_page.get_text.return_value = [] # No captions
    
    # Mock Extract Image
    mock_doc.extract_image.return_value = {
        "image": b"fake-png-data",
        "width": 100,
        "height": 100
    }
    
    output_dir = tmp_path / "extracted"
    new_entries = extract_images("fake.pdf", output_root=str(output_dir))
    
    assert len(new_entries) == 1
    assert os.path.exists(output_dir / "metadata.json")
    assert os.path.exists(output_dir / "images" / f"{new_entries[0]['image_id']}.png")
```

- [ ] **Step 3: Run all tests**
Run: `pytest test_chapter_resolver.py test_extract_images.py`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add extract_images.py test_extract_images.py
git commit -m "feat: implement image extractor with rich metadata and tests"
```

---

### Task 4: Live Run and Verification

- [ ] **Step 1: Execute extraction on Pathoma 2021.pdf**
Run: `python extract_images.py "Pathoma 2021.pdf"`

- [ ] **Step 2: Execute extraction on First Aid 2023**
Run: `python extract_images.py "First Aid for the USMLE Step 1 2023, 33e.pdf"`

- [ ] **Step 3: Final Commit**
```bash
git add extracted_images/metadata.json
git commit -m "feat: complete image extraction for all books"
```
