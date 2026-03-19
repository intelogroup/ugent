# Pinecone Local Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Securely set up a local development environment for Pinecone with API key management and a connection utility.

**Architecture:** Use `.env` for secrets, `python-dotenv` for environment management, and a dedicated `pinecone_init.py` for client initialization.

**Tech Stack:** Python, `pinecone`, `python-dotenv`, `pytest`.

---

### Task 1: Initialize Project Structure and Dependencies

**Files:**
- Create: `.gitignore`
- Create: `requirements.txt`

- [ ] **Step 1: Create .gitignore to protect secrets**
Create `.gitignore` and add `.env` and `__pycache__/`.

```bash
echo ".env" > .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
```

- [ ] **Step 2: Create requirements.txt with dependencies**
Add `pinecone`, `python-dotenv`, and `pytest`.

```text
pinecone
python-dotenv
pytest
```

- [ ] **Step 3: Install dependencies**
Run: `pip install -r requirements.txt`

- [ ] **Step 4: Commit**
```bash
git init
git add .gitignore requirements.txt
git commit -m "chore: initialize project structure and dependencies"
```

---

### Task 2: Configure Environment Variables

**Files:**
- Create: `.env`

- [ ] **Step 1: Create .env file with provided API key**
Populate `.env` with the API key and index name. (Note: The user provided the key in the session).

```bash
echo "PINECONE_API_KEY=\"pcsk_MiWu4_SBBBduAq1iksmsHQkSkkNQYL3gXTpfZn4qEnyxCstNHHUn1NiyjR6Ctpg5kbxUq\"" > .env
echo "PINECONE_INDEX_NAME=\"quickstart\"" >> .env
```

- [ ] **Step 2: Verify .env exists and is ignored**
Run: `ls -a .env` and `git check-ignore .env`
Expected: `.env` listed and `git check-ignore` returns `.env`.

---

### Task 3: Implement Pinecone Initialization Utility

**Files:**
- Create: `pinecone_init.py`
- Test: `test_pinecone_init.py`

- [ ] **Step 1: Write a failing test for initialization**
Create `test_pinecone_init.py`.

```python
import os
from pinecone_init import get_pinecone_index

def test_get_pinecone_index_success(monkeypatch):
    monkeypatch.setenv("PINECONE_API_KEY", "test-key")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "test-index")
    # This will fail initially because pinecone_init is not implemented
    try:
        index = get_pinecone_index()
    except ImportError:
        assert True
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest test_pinecone_init.py`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement minimal pinecone_init.py**
Create `pinecone_init.py`.

```python
import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

def get_pinecone_index():
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME")
    
    if not api_key or not index_name:
        raise ValueError("Missing PINECONE_API_KEY or PINECONE_INDEX_NAME")
        
    pc = Pinecone(api_key=api_key)
    return pc.Index(index_name)

if __name__ == "__main__":
    index = get_pinecone_index()
    print(f"Successfully connected to index: {os.getenv('PINECONE_INDEX_NAME')}")
```

- [ ] **Step 4: Run test to verify it passes (with mocks)**
Update `test_pinecone_init.py` to mock Pinecone.

```python
import os
from unittest.mock import MagicMock, patch
from pinecone_init import get_pinecone_index

@patch("pinecone_init.Pinecone")
def test_get_pinecone_index_success(mock_pinecone, monkeypatch):
    monkeypatch.setenv("PINECONE_API_KEY", "test-key")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "test-index")
    
    mock_instance = MagicMock()
    mock_pinecone.return_value = mock_instance
    
    index = get_pinecone_index()
    
    mock_pinecone.assert_called_once_with(api_key="test-key")
    mock_instance.Index.assert_called_once_with("test-index")
```

- [ ] **Step 5: Run tests**
Run: `pytest test_pinecone_init.py`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add pinecone_init.py test_pinecone_init.py
git commit -m "feat: implement pinecone initialization utility"
```

---

### Task 4: Final Integration Test (Live)

- [ ] **Step 1: Run the initialization script with live credentials**
Run: `python pinecone_init.py`
Expected: `Successfully connected to index: quickstart`

- [ ] **Step 2: Final Commit and Cleanup**
Ensure everything is working and commit any final adjustments.
