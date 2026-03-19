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

- [ ] **Step 1: Write failing test for chunking with breadcrumbs and images**
Create `test_chunker.py`. Include a test for image tag detection.

```python
from chunker import chunk_markdown
from image_mapper import ImageMapper

def test_chunk_markdown_with_images(tmp_path):
    # Setup mock ImageMapper
    metadata_file = tmp_path / "metadata.json"
    metadata_file.write_text('[{"filename": "img1.png", "image_id": "hash123"}]')
    mapper = ImageMapper(str(metadata_file))
    
    content = "# Ch1\n![alt](img1.png)\nSome text."
    chunks = chunk_markdown(content, "First Aid", image_mapper=mapper)
    
    assert len(chunks) > 0
    # Verify metadata (this implies chunk_markdown returns objects/dicts)
    assert chunks[0]["metadata"]["image_ids"] == ["hash123"]
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest test_chunker.py`
Expected: FAIL.

- [ ] **Step 3: Implement robust chunk_markdown in chunker.py**
Handle headers, breadcrumbs, and image tag extraction.

```python
import re

def chunk_markdown(content, book_name, image_mapper=None, max_tokens=512):
    lines = content.split('\n')
    chunks = []
    current_headers = {1: None, 2: None, 3: None}
    
    for line in lines:
        # Header detection (including SECTION markers)
        header_match = re.match(r'^(#+)\s+(.*)|^SECTION\s+(.*)', line)
        if header_match:
            # ... update current_headers ...
            continue
            
        # Image detection: ![alt](filename)
        image_matches = re.findall(r'!\[.*?\]\((.*?)\)', line)
        image_ids = []
        if image_mapper:
            image_ids = [image_mapper.get_id(img) for img in image_matches if image_mapper.get_id(img)]
            
        # Build breadcrumb and chunk
        # ... logic to group lines into chunks ...
        # chunk = {"text": text, "metadata": {"image_ids": image_ids, ...}}
    return chunks
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest test_chunker.py`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add chunker.py test_chunker.py
git commit -m "feat: implement robust markdown chunking with image-id mapping"
```

---

### Task 3: Image-ID Mapping Utility

**Files:**
- Create: `image_mapper.py`
- Test: `test_image_mapper.py`

- [ ] **Step 1: Write failing test for image mapping**
(Same as before).

- [ ] **Step 2: Run test to verify it fails**
(Same as before).

- [ ] **Step 3: Implement ImageMapper in image_mapper.py**
(Same as before).

- [ ] **Step 4: Run test to verify it passes**
(Same as before).

- [ ] **Step 5: Commit**
(Same as before).

---

### Task 4: Embedding & Indexing Pipeline with Checkpointing

**Files:**
- Create: `embed_books.py`
- Test: `test_embed_books.py`

- [ ] **Step 1: Write failing test for batching and checkpointing**
Create `test_embed_books.py` to verify the checkpoint is saved after a batch.

- [ ] **Step 2: Implement minimal embed_books.py with checkpointing**
Focus on the loop and state persistence.

- [ ] **Step 3: Add OpenAI embedding logic with retries**
Use `tenacity` or a custom loop for retries and rate limiting.

- [ ] **Step 4: Add Pinecone upsert logic**
Integrate the metadata schema from the design.

- [ ] **Step 5: Test with a small sample file**
Run: `python embed_books.py --limit-files 1`
Expected: Success message and `checkpoint.json` updated.

- [ ] **Step 6: Commit**
```bash
git add embed_books.py test_embed_books.py
git commit -m "feat: implement resilient embedding pipeline with batching and checkpointing"
```
