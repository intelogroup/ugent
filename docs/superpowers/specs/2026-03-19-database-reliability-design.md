# Design: Custom Database Error Class for RAG Reliability

This design addresses the requirement to verify and ensure that the application reliably reaches the vector database (Pinecone) and reports failures rather than masking them as empty results.

## Architecture & Components

1.  **Custom Error Classes (`lib/errors.ts`)**:
    *   `BaseError`: A standard extension of the built-in `Error` class with a `code` and `status` field.
    *   `DatabaseError`: Specific for Pinecone connectivity or query failures.
    *   `EmbeddingError`: Specific for OpenAI embedding generation failures.

2.  **Updated Library Wrappers**:
    *   `lib/openai.ts`: Will throw `EmbeddingError` if OpenAI fails.
    *   `lib/pinecone.ts`: Will catch low-level errors and re-throw them as `DatabaseError`.

3.  **Updated API Route (`app/api/chat/route.ts`)**:
    *   Will catch these specific errors and:
        *   Log them appropriately.
        *   Inform the user (via `StreamData` metadata or a system message) that a database failure occurred, distinguishing it from "No context found".

## Data Flow

1.  `POST /api/chat` -> `getContext(query)`
2.  `getContext(query)` -> `getEmbedding(query)`
    *   If `getEmbedding` fails -> `EmbeddingError` -> Caught by `getContext` -> Re-thrown as `DatabaseError` or handled.
3.  `getContext(query)` -> `pinecone.query(...)`
    *   If `pinecone.query` fails -> `DatabaseError`.
4.  `POST /api/chat` catches `DatabaseError`:
    *   Logs "CRITICAL: Database connection failed".
    *   `StreamData.append({ db_error: true })`.
    *   System Prompt is adjusted or an error message is sent to the user.

## Testing Strategy

1.  **Unit Tests**: Mock Pinecone/OpenAI failures to ensure `DatabaseError` and `EmbeddingError` are correctly thrown and handled.
2.  **Integration Test**: A manual test script (`scripts/verify-db.ts`) that intentionally uses a bad API key or index name to verify the error reporting.
3.  **UI Verification**: Confirm the chat UI displays a meaningful status or fallback when the DB is unreachable.

---
Does this design look right to you so far?
