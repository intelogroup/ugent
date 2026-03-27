import os
import json
import time
import hashlib
import argparse
from typing import List
from dotenv import load_dotenv
from openai import OpenAI
from pinecone_init import get_pinecone_index
from chunker import chunk_markdown
from image_mapper import ImageMapper

# Load environment variables
load_dotenv(".env.local")

# Constants
CHECKPOINT_FILE = "checkpoint.json"
BATCH_SIZE = 100
EMBEDDING_MODEL = "text-embedding-3-large"
DIMENSIONS = 1024  # must match openai.ts getEmbedding() and the Pinecone index dimension

# Files that produce noise chunks (indexes, image credits, frontmatter).
# These pollute rankings because their content is structural, not educational.
SKIP_FILES = {
    "Chapter_20_Index.md",        # Pathoma
    "21_Index.md",                # First Aid
    "20_Image_Acknowledgments.md",
    "00_Frontmatter.md",
}

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Fetch embeddings for a batch of texts with retry logic."""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL,
                dimensions=DIMENSIONS
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            wait_time = 2 ** attempt
            print(f"Error fetching embeddings, retrying in {wait_time}s: {e}")
            time.sleep(wait_time)

def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"last_book": None, "last_file": None, "last_chunk_index": -1}

def save_checkpoint(last_book, last_file, last_chunk_index):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({
            "last_book": last_book,
            "last_file": last_file,
            "last_chunk_index": last_chunk_index
        }, f)

def main():
    parser = argparse.ArgumentParser(description="Embed books into Pinecone")
    parser.add_argument(
        "--namespace",
        choices=["first-aid-2023", "pathoma-2021"],
        help="Only process this namespace (omit to process all)"
    )
    args = parser.parse_args()

    index = get_pinecone_index()
    image_mapper = ImageMapper(os.path.abspath("extracted_images/metadata.json"))

    all_books = [
        {
            "name": "First Aid for the USMLE Step 1 2023",
            "dir": "scraped_first_aid_final",
            "namespace": "first-aid-2023"
        },
        {
            "name": "Pathoma 2021",
            "dir": "scraped_pathoma",
            "namespace": "pathoma-2021"
        }
    ]

    books = [b for b in all_books if not args.namespace or b["namespace"] == args.namespace]

    checkpoint = load_checkpoint()
    last_book = checkpoint.get("last_book")
    last_file = checkpoint.get("last_file")
    last_chunk_index = checkpoint.get("last_chunk_index", -1)
    
    # If last_book is set, we skip until we find it.
    found_last_book = False if last_book else True
    
    for book in books:
        if not found_last_book:
            if book["name"] == last_book:
                found_last_book = True
            else:
                continue
                
        files = sorted([f for f in os.listdir(book["dir"]) if f.endswith(".md") and f not in SKIP_FILES])
        
        found_last_file = False if last_file and book["name"] == last_book else True
        
        for filename in files:
            file_path = os.path.join(book["dir"], filename)
            
            if not found_last_file:
                if filename == last_file:
                    found_last_file = True
                else:
                    continue
            
            print(f"Processing {file_path}...")
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            chunks = chunk_markdown(content, book["name"], image_mapper)
            
            # Resume from last_chunk_index if we just started
            start_idx = 0
            if filename == last_file and book["name"] == last_book:
                start_idx = last_chunk_index + 1
            
            for i in range(start_idx, len(chunks), BATCH_SIZE):
                batch_chunks = chunks[i:i + BATCH_SIZE]
                batch_texts = [c["text"] for c in batch_chunks]
                
                embeddings = get_embeddings(batch_texts)
                
                vectors = []
                for j, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings)):
                    # Generate a stable ID based on file path, position, and text hash
                    chunk_text = chunk["text"]
                    # hash the text to avoid too long strings in id
                    text_hash = hashlib.md5(chunk_text.encode()).hexdigest()
                    chunk_id = f"{book['namespace']}_{filename}_{i+j}_{text_hash}"
                    
                    metadata = chunk["metadata"].copy()
                    metadata["text"] = chunk_text
                    
                    # Ensure no None values in metadata for Pinecone
                    for k, v in metadata.items():
                        if v is None:
                            metadata[k] = ""
                            
                    vectors.append({
                        "id": chunk_id,
                        "values": embedding,
                        "metadata": metadata
                    })
                
                # Upsert in batch
                index.upsert(vectors=vectors, namespace=book["namespace"])
                
                # Update checkpoint
                save_checkpoint(book["name"], filename, i + len(batch_chunks) - 1)
                print(f"  Upserted {len(vectors)} chunks (up to index {i + len(batch_chunks) - 1})")

if __name__ == "__main__":
    main()
