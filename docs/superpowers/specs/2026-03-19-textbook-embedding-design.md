# Medical Textbook Embedding & Pinecone Indexing Design

This document specifies the design for chunking, embedding, and indexing "First Aid for the USMLE Step 1 2023" and "Pathoma 2021" into a Pinecone vector database for high-accuracy medical search.

## 1. Goal
Create a robust, context-aware retrieval system using OpenAI's `text-embedding-3-large` that allows for fast and accurate semantic search across text and associated images.

## 2. Components

### 2.1 Data Processing Pipeline
- **Input:** Scraped Markdown files in `scraped_first_aid_final/` and `scraped_pathoma/`.
- **Chunking Engine:**
  - **Strategy:** Hierarchical Markdown-aware splitting.
  - **Chunk Sizes:** 
    - Small (256-512 tokens) for granular facts.
    - Medium (1024 tokens) for broader section context.
  - **Overlap:** 15% (approximately 40-150 tokens) to maintain semantic continuity.
- **Contextual Injection (Breadcrumbs):**
  - Every chunk will be prefixed with its hierarchical location (e.g., `[Book: First Aid] > [Section: Biochemistry] > [Topic: DNA Methylation]`).
  - This ensures embeddings capture the "where" and "what" even for generic text snippets.

### 2.2 Embedding Model
- **Model:** OpenAI `text-embedding-3-large`.
- **Dimensions:** 3072 (full resolution for maximum accuracy).
- **Batching:** Process chunks in batches of 100 to optimize API costs and latency.

### 2.3 Vector Database (Pinecone)
- **Index Name:** `medical-textbooks` (or as configured in `.env`).
- **Metric:** `cosine` similarity.
- **Namespaces:**
  - `first-aid-2023`
  - `pathoma-2021`
- **Metadata Schema:**
  - `text`: The actual chunk content (including breadcrumbs).
  - `source_book`: String identifier.
  - `chapter`: String identifier.
  - `page_number`: Integer.
  - `section_headers`: List of strings representing the hierarchy.
  - `image_ids`: List of associated image hashes (linked to `extracted_images/`).

### 2.4 Image Integration
- **Approach:** Text-Linked proximity.
- **Logic:** During scraping/chunking, if an image tag is encountered, its ID is stored in the metadata of the surrounding text chunks.
- **Retrieval:** The UI retrieves the text chunk and uses the `image_ids` metadata to fetch and display the image from the local `extracted_images/` storage.

## 3. Data Flow
1. **Load Markdown:** Read files sequentially from the scraped directories.
2. **Parse Hierarchy:** Extract headers (`#`, `##`, `###`) to build the breadcrumb string.
3. **Generate Chunks:** Apply recursive splitting while preserving header context.
4. **Embed:** Send batches of text to OpenAI.
5. **Upsert:** Push vectors and metadata to Pinecone in the appropriate namespace.

## 4. Implementation Details
- A script `embed_books.py` will handle the full pipeline.
- Metadata filters will be used at query time to allow users to toggle between books or focus on specific chapters.
