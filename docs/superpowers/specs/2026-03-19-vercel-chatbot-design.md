# Design Spec: Vercel Textbook Chatbot (Next.js + AI SDK)

## 1. Objective
Build a visually polished, high-performance chatbot deployed on Vercel that allows users to query medical textbooks (First Aid, Pathoma) stored in a Pinecone vector database. The chatbot should stream responses and display relevant textbook images using RAG.

## 2. Architecture
- **Framework:** Next.js (App Router)
- **AI Library:** Vercel AI SDK (with OpenAI/Anthropic provider)
- **Database:** Pinecone (Vector Store)
- **Storage:** Local Git LFS for 2,000+ images (served via `/public`)
- **Styling:** Tailwind CSS + Lucide Icons

## 3. Key Components
### 3.1 Backend (Route Handlers)
- `POST /api/chat`:
  - Vectorize user query using `text-embedding-3-large`.
  - Fetch Top-K context chunks from Pinecone.
  - Construct system prompt with textbook context.
  - Return `streamText` response for the frontend.

### 3.2 Frontend (Client Components)
- `ChatInterface`:
  - `useChat` hook for managing message state and streaming.
  - `MessageList`: Renders chat bubbles with Markdown support.
  - `ImageRenderer`: Detects image IDs in bot responses and displays them using `next/image`.

### 3.3 Data Flow
1. User enters a query (e.g., "What is the mechanism of action for Heparin?").
2. Query is vectorized and sent to Pinecone.
3. Relevant chunks (text + metadata with image IDs) are retrieved.
4. LLM processes context and query, streaming a response.
5. Frontend renders text and pulls matching image files from `/public/extracted_images/images/`.

## 4. Image Handling
- **Strategy:** Images are stored in `public/extracted_images/images/`.
- **Mapping:** The bot will include references like `[Image: ID]` in its text, which the frontend will parse and turn into responsive `<img>` tags.

## 5. Security & Constraints
- **Secrets:** Pinecone API Key and OpenAI API Key managed via Vercel Environment Variables.
- **Git LFS:** Repository configuration must support LFS fetching on Vercel deployment (or use a separate blob storage if LFS exceeds Vercel limits).

## 6. Success Criteria
- [ ] Chatbot streams text responses.
- [ ] Textbook context is accurately retrieved.
- [ ] Images matching the context are displayed inline.
- [ ] UI is responsive and optimized for medical review.
