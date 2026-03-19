# Medical Textbook Embedding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chunk, embed, and index First Aid and Pathoma textbooks into Pinecone using OpenAI's `text-embedding-3-large` with metadata enrichment.

**Architecture:** A Python-based pipeline that reads Markdown, generates breadcrumb-enriched chunks, retrieves image IDs from a local metadata registry, and upserts vectors to Pinecone with checkpointing and rate limiting.

**Tech Stack:** Python, `pinecone`, `openai`, `python-dotenv`, `tqdm`, `pytest`.

---

### Task 1: Environment & Dependencies Update

**Files:**
- Modify: `requirements.txt`
- Modify: `.env`

- [ ] **Step 1: Update requirements.txt**
Add `openai` and `tqdm`.

```text
pinecone
python-dotenv
pytest
openai
tqdm
```

- [ ] **Step 2: Install updated dependencies**
Run: `pip install -r requirements.txt`

- [ ] **Step 3: Add OpenAI API Key to .env**
Ensure the user has provided their OpenAI API key.

```bash
echo "OPENAI_API_KEY=\"your-api-key-here\"" >> .env
```

- [ ] **Step 4: Commit**
```bash
git add requirements.txt
git commit -m "chore: update dependencies for embedding and openai"
```

---

### Task 2: Implement Markdown Chunking Logic

**Files:**
- Create: `chunker.py`
- Test: `test_chunker.py`

- [ ] **Step 1: Write failing test for chunking with breadcrumbs**
Create `test_chunker.py`.

```python
from chunker import chunk_markdown

def test_chunk_markdown_with_breadcrumbs():
    content = "# Ch1\n## Sec1\nSome text here."
    book_name = "First Aid"
    chunks = chunk_markdown(content, book_name)
    assert len(chunks) > 0
    assert "[Book: First Aid] > [Chapter: Ch1] > [Section: Sec1]" in chunks[0]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest test_chunker.py`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement chunk_markdown in chunker.py**
Implement logic to parse headers and prepend breadcrumbs.

```python
import re

def chunk_markdown(content, book_name, max_tokens=512):
    # Minimal implementation for breadcrumb parsing
    lines = content.split('\n')
    chunks = []
    current_headers = {1: None, 2: None, 3: None}
    
    current_chunk_text = ""
    for line in lines:
        header_match = re.match(r'^(#+)\s+(.*)', line)
        if header_match:
            level = len(header_match.group(1))
            name = header_match.group(2)
            if level in current_headers:
                current_headers[level] = name
                # Clear sub-headers
                for i in range(level + 1, 4):
                    current_headers[i] = None
        
        # Build breadcrumb
        breadcrumb_parts = [f"[Book: {book_name}]"]
        if current_headers[1]: breadcrumb_parts.append(f"[Chapter: {current_headers[1]}]")
        if current_headers[2]: breadcrumb_parts.append(f"[Section: {current_headers[2]}]")
        breadcrumb = " > ".join(breadcrumb_parts)
        
        # Simple line-based chunking for now
        if line.strip() and not header_match:
            chunks.append(f"{breadcrumb}\n---\n{line}")
            
    return chunks
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest test_chunker.py`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add chunker.py test_chunker.py
git commit -m "feat: implement basic hierarchical markdown chunking"
```

---

### Task 3: Image-ID Mapping Utility

**Files:**
- Create: `image_mapper.py`
- Test: `test_image_mapper.py`

- [ ] **Step 1: Write failing test for image mapping**
Create `test_image_mapper.py`.

```python
import json
import os
from image_mapper import ImageMapper

def test_resolve_image_id(tmp_path):
    metadata_file = tmp_path / "metadata.json"
    metadata_file.write_text(json.dumps([{"filename": "img1.png", "image_id": "hash123"}]))
    
    mapper = ImageMapper(str(metadata_file))
    assert mapper.get_id("img1.png") == "hash123"
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest test_image_mapper.py`
Expected: FAIL.

- [ ] **Step 3: Implement ImageMapper in image_mapper.py**
Load `metadata.json` and provide lookup.

```python
import json

class ImageMapper:
    def __init__(self, metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                data = json.load(f)
                self.mapping = {item['filename']: item['image_id'] for item in data}
        except FileNotFoundError:
            self.mapping = {}

    def get_id(self, filename):
        return self.mapping.get(filename)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest test_image_mapper.py`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add image_mapper.py test_image_mapper.py
git commit -m "feat: add image-id mapping utility"
```

---

### Task 4: Embedding & Indexing Pipeline with Checkpointing

**Files:**
- Create: `embed_books.py`

- [ ] **Step 1: Implement minimal embed_books.py structure**
Include `get_pinecone_index`, `OpenAI` client, and checkpointing logic.

```python
import os
import json
from openai import OpenAI
from pinecone_init import get_pinecone_index
from chunker import chunk_markdown
from image_mapper import ImageMapper
from tqdm import tqdm

client = OpenAI()
index = get_pinecone_index()

def save_checkpoint(data):
    with open('checkpoint.json', 'w') as f:
        json.dump(data, f)

def load_checkpoint():
    if os.path.exists('checkpoint.json'):
        with open('checkpoint.json', 'r') as f:
            return json.load(f)
    return {"processed_files": []}

def run_pipeline():
    checkpoint = load_checkpoint()
    # Mock loop for structure
    print("Starting pipeline...")
    # ... logic to iterate files, chunk, embed, and upsert ...

if __name__ == "__main__":
    run_pipeline()
```

- [ ] **Step 2: Implement full pipeline logic in embed_books.py**
(I will provide the full implementation during execution).

- [ ] **Step 3: Test with a small sample file**
Run: `python embed_books.py` (ensure `.env` has valid keys).

- [ ] **Step 4: Commit**
```bash
git add embed_books.py
git commit -m "feat: implement full embedding and indexing pipeline with checkpointing"
```
