# Pinecone Local Environment Setup Design

This document specifies the design for securely setting up a local development environment to interact with a Pinecone vector database.

## 1. Goal
Provide a secure and standardized way to store Pinecone API keys and initialize the client for local development in the `/Users/kalinovdameus/Developer/ugent/` workspace.

## 2. Components

### 2.1 Configuration File (`.env`)
- **Location:** Project root.
- **Purpose:** Store sensitive credentials as environment variables.
- **Content:**
  - `PINECONE_API_KEY`: The primary authentication key.
  - `PINECONE_INDEX_NAME`: The target index for operations (e.g., `quickstart`).

### 2.2 Version Control Exclusion (`.gitignore`)
- **Location:** Project root.
- **Purpose:** Ensure the `.env` file is never tracked by Git.
- **Content:** Added `.env` to the list of ignored files.

### 2.3 Dependencies
- **Pinecone SDK:** `pinecone` (latest stable).
- **Environment Management:** `python-dotenv` for loading variables from `.env`.

## 3. Data Flow
1. The developer populates `.env` with their API key.
2. The `python-dotenv` library reads the `.env` file and populates `os.environ`.
3. The Pinecone client is initialized using `os.getenv("PINECONE_API_KEY")`.
4. Operations are performed against the index specified in `PINECONE_INDEX_NAME`.

## 4. Implementation Details
A sample script `pinecone_init.py` will be used to verify the setup.

```python
import os
from dotenv import load_dotenv
from pinecone import Pinecone

# Load environment variables
load_dotenv()

# Initialize Pinecone
api_key = os.getenv("PINECONE_API_KEY")
index_name = os.getenv("PINECONE_INDEX_NAME")

if not api_key or not index_name:
    raise ValueError("Missing PINECONE_API_KEY or PINECONE_INDEX_NAME in .env")

pc = Pinecone(api_key=api_key)
index = pc.Index(index_name)

print(f"Successfully connected to index: {index_name}")
```
