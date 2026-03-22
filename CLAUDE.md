# UGent — Claude Context

## Scope
Read `scope.md` before any task. Do not touch out-of-scope files or features.
If a requested change conflicts with scope.md, say so and stop.

## Stack
- Next.js 15, React 19, TypeScript, Tailwind
- Convex (backend + realtime), better-auth (auth)
- OpenAI SDK, Pinecone (vector search), Tavily (web search)
- Vercel AI SDK, Playwright (e2e), Vitest (unit)
- Python embedding pipeline: chunker.py, embed_books.py, embed_images.py

## Key Constraints
- Auth uses better-auth + Convex — do not introduce custom session handling
- Embedding pipeline targets First Aid (2023) and Pathoma (2021) only
- Do not expose raw book chunks or embeddings in API responses — use retrieval layer
- Pinecone index schema must remain stable — do not alter dimensions or metadata fields
- Frontend in `ugent-app/` is a separate repo — do not modify it from here

## Test Requirement
Run `npm test` — all 37 tests must pass. No regressions allowed.
