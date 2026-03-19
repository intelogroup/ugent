# Vercel Textbook Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Next.js chatbot that uses the Vercel AI SDK to stream responses from a Pinecone-backed RAG system, displaying textbook images inline.

**Architecture:** Next.js App Router with Route Handlers for the backend. The frontend uses `useChat` for streaming and a custom image renderer for textbook assets.

**Tech Stack:** Next.js, Vercel AI SDK, Pinecone, OpenAI Embeddings, Tailwind CSS.

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `.env.local`

- [ ] **Step 1: Initialize Next.js project**

Run: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*" --use-npm --yes`

- [ ] **Step 2: Install AI SDK and Pinecone dependencies**

Run: `npm install ai openai @pinecone-database/pinecone lucide-react clsx tailwind-merge`

- [ ] **Step 3: Setup environment variables**

```text
OPENAI_API_KEY=your_key
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=your_index
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: initial next.js scaffold with dependencies"
```

---

### Task 2: Pinecone Retrieval Utility

**Files:**
- Create: `lib/pinecone.ts`
- Create: `lib/openai.ts`

- [ ] **Step 1: Implement OpenAI embedding helper**

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

export async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text.replace(/\n/g, ' '),
    dimensions: 1024,
  });
  return response.data[0].embedding;
}
```

- [ ] **Step 2: Implement Pinecone search logic**

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './openai';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

export async function getContext(query: string) {
  const embedding = await getEmbedding(query);
  const results = await index.namespace('first-aid-2023').query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });
  
  // Combine with pathoma-2021 if needed, or query both
  return results.matches.map(m => m.metadata);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add pinecone and openai retrieval utilities"
```

---

### Task 3: AI SDK Route Handler

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Implement POST handler with context injection**

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getContext } from '@/lib/pinecone';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;
  
  const context = await getContext(lastMessage);
  const contextText = context.map(c => `[Source: ${c.book} > ${c.chapter}]\n${c.text}\nImages: ${JSON.stringify(c.image_ids)}`).join('\n\n');

  return streamText({
    model: openai('gpt-4o'),
    system: `You are a medical study assistant. Use the following textbook context to answer: \n\n${contextText}\n\nIf you reference an image, include its ID like this: [Image: ID]`,
    messages,
  }).toDataStreamResponse();
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: implement streaming chat api route with RAG context"
```

---

### Task 4: Chat UI & Image Rendering

**Files:**
- Create: `components/chat-interface.tsx`
- Create: `components/image-renderer.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create ImageRenderer component**

```typescript
import Image from 'next/image';

export function ImageRenderer({ content }: { content: string }) {
  const imageRegex = /\[Image: (.*?)\]/g;
  const parts = content.split(imageRegex);
  
  return (
    <>
      {parts.map((part, i) => (
        i % 2 === 0 ? part : (
          <div key={i} className="my-4 border rounded-lg overflow-hidden">
            <Image 
              src={`/extracted_images/images/${part}.png`} 
              alt="Textbook Image" 
              width={800} 
              height={600}
              className="w-full h-auto"
            />
          </div>
        )
      ))}
    </>
  );
}
```

- [ ] **Step 2: Implement ChatInterface with useChat**

- [ ] **Step 3: Update main page**

- [ ] **Step 4: Commit**

```bash
git add components/ app/page.tsx
git commit -m "feat: add chat ui and image rendering support"
```

---

### Task 5: Static Asset Linking & Final Polish

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Ensure images are accessible to Next.js**

Symlink `extracted_images` to `public/extracted_images`.

- [ ] **Step 2: Add Tailwind typography and refine styles**

- [ ] **Step 3: Final validation and Commit**

```bash
git commit -m "style: final UI polish and asset linking"
```
