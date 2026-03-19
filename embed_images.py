"""
embed_images.py — Embed real medical images into Pinecone `images` namespace.

Filters out artifacts/icons (< 5KB or < 100px either dimension).
Builds descriptions from caption_candidate + book + page metadata.
Embeds with text-embedding-3-large (1024 dims, matches existing index).
"""

import os
import json
import time
from typing import List
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm
from PIL import Image
from pinecone_init import get_pinecone_index

load_dotenv()
load_dotenv(".env.local", override=True)  # .env.local takes precedence (has valid keys)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

IMG_DIR = "public/extracted_images/images"
METADATA_PATH = "public/extracted_images/metadata.json"
EMBEDDING_MODEL = "text-embedding-3-large"
DIMENSIONS = 1024
BATCH_SIZE = 100
IMAGES_NAMESPACE = "images"

MIN_FILE_SIZE_KB = 5
MIN_DIMENSION_PX = 100

JUNK_CAPTIONS = {"", "xx", "x", "a", "b", "c"}


def is_real_image(path: str) -> bool:
    """Returns True if the file is large enough to be a real medical diagram."""
    kb = os.path.getsize(path) / 1024
    if kb < MIN_FILE_SIZE_KB:
        return False
    try:
        with Image.open(path) as im:
            w, h = im.size
            return w >= MIN_DIMENSION_PX and h >= MIN_DIMENSION_PX
    except Exception:
        return False


def clean_caption(raw: str) -> str:
    """Returns None if the caption is junk, otherwise the cleaned caption."""
    cap = raw.strip()
    if cap.lower() in JUNK_CAPTIONS:
        return ""
    if "t.me" in cap.lower() or "telegram" in cap.lower():
        return ""
    # Strip control characters
    cap = "".join(c for c in cap if c >= " " or c == "\n")
    return cap.strip()


def build_description(entry: dict) -> str:
    """
    Build a semantically rich text description for embedding.
    Format: "<Book> | Page <N> | <Caption>"
    """
    book = entry.get("source_book", "").replace(".pdf", "").strip()
    page = entry.get("page_number", "")
    cap = clean_caption(entry.get("caption_candidate", ""))

    parts = [book, f"Page {page}"]
    if cap:
        parts.append(cap)
    return " | ".join(parts)


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts with retry logic."""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL,
                dimensions=DIMENSIONS,
            )
            return [d.embedding for d in response.data]
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  Embedding error (attempt {attempt+1}), retrying in {wait}s: {e}")
            time.sleep(wait)


def main():
    index = get_pinecone_index()
    metadata = json.load(open(METADATA_PATH, encoding="utf-8"))

    # Filter to real images only
    real_images = []
    skipped_missing = 0
    skipped_small = 0

    for entry in metadata:
        path = os.path.join(IMG_DIR, entry["filename"])
        if not os.path.exists(path):
            skipped_missing += 1
            continue
        if not is_real_image(path):
            skipped_small += 1
            continue
        real_images.append(entry)

    print(f"Total metadata entries : {len(metadata)}")
    print(f"Missing files          : {skipped_missing}")
    print(f"Filtered (too small)   : {skipped_small}")
    print(f"Real images to embed   : {len(real_images)}")
    print()

    total_upserted = 0

    for i in tqdm(range(0, len(real_images), BATCH_SIZE), desc="Embedding images"):
        batch = real_images[i : i + BATCH_SIZE]
        descriptions = [build_description(e) for e in batch]
        embeddings = get_embeddings(descriptions)

        vectors = []
        for entry, emb, desc in zip(batch, embeddings, descriptions):
            cap = clean_caption(entry.get("caption_candidate", ""))
            vectors.append(
                {
                    "id": entry["image_id"],
                    "values": emb,
                    "metadata": {
                        "image_id": entry["image_id"],
                        "filename": entry["filename"],
                        "source_book": entry.get("source_book", "").replace(".pdf", ""),
                        "page_number": entry.get("page_number", 0),
                        "caption": cap,
                        "description": desc,
                    },
                }
            )

        index.upsert(vectors=vectors, namespace=IMAGES_NAMESPACE)
        total_upserted += len(vectors)

    print(f"\nDone. Upserted {total_upserted} image vectors to namespace '{IMAGES_NAMESPACE}'.")


if __name__ == "__main__":
    main()
