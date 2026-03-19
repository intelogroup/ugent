# Mobile-First Medical Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, ChatGPT-style chat interface for medical textbook querying with inline reference cards and citations.

**Architecture:** Next.js App Router with Vercel AI SDK for streaming, Tailwind CSS for styling, and Framer Motion for animations.

**Tech Stack:** Next.js 15, Tailwind CSS, Lucide Icons, Framer Motion, Vercel AI SDK, Pinecone.

---

### Task 1: Setup Core UI Structure and Theme

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `components/ui/header.tsx`
- Create: `components/ui/drawer.tsx`

- [ ] **Step 1: Configure global styles for mobile-first**
Update `app/globals.css` to ensure `h-screen` behavior and clean typography.

- [ ] **Step 2: Implement Sticky Header**
Create `components/ui/header.tsx` with `Menu`, Bot Title, and `SquarePen` icons.

- [ ] **Step 3: Implement Slide-out Navigation Drawer**
Create `components/ui/drawer.tsx` using `framer-motion` for the slide-in animation. Include Chat History placeholders and Theme/Model settings.

- [ ] **Step 4: Integrate into layout**
Update `app/layout.tsx` to include the Header and Drawer components.

---

### Task 2: Implement Chat Interface and Message Bubbles

**Files:**
- Create: `components/chat/chat-interface.tsx`
- Create: `components/chat/message-bubble.tsx`
- Create: `components/chat/input-bar.tsx`

- [ ] **Step 1: Create Message Bubble Component**
Implement `message-bubble.tsx` with distinct styles for User (gray bubble) and Bot (raw text + Bot avatar).

- [ ] **Step 2: Create Auto-expanding Input Bar**
Implement `input-bar.tsx` with a `max-h-[200px]` constraint and a circular send button.

- [ ] **Step 3: Assemble Chat Interface**
Combine bubbles and input into `chat-interface.tsx`. Use `useChat` from `ai/react` for state management.

- [ ] **Step 4: Add Empty State**
Implement the "Hero" section with Bot icon and starter prompts when no messages exist.

---

### Task 3: Implement Medical Reference Cards and Lightbox

**Files:**
- Create: `components/chat/reference-card.tsx`
- Create: `components/ui/lightbox.tsx`
- Modify: `components/chat/message-bubble.tsx`

- [ ] **Step 1: Create Reference Card Component**
Implement `reference-card.tsx` with a 4:3 `object-contain` container and metadata section.

- [ ] **Step 2: Implement Lightbox Modal**
Create `components/ui/lightbox.tsx` for full-screen image viewing with pinch-to-zoom (placeholder logic).

- [ ] **Step 3: Update Message Bubble to parse custom Markdown**
Update `message-bubble.tsx` to detect `![[ref:IMG_ID]]` and render the `ReferenceCard`.

---

### Task 4: Implement Citations and Bottom-Sheet

**Files:**
- Create: `components/chat/citation-chip.tsx`
- Create: `components/ui/bottom-sheet.tsx`
- Create: `app/api/sources/[id]/route.ts`

- [ ] **Step 1: Create Citation Chip**
Small pill component that displays book/page info.

- [ ] **Step 2: Implement Bottom-Sheet for Source Preview**
Create `bottom-sheet.tsx` that slides up from the bottom when a citation is tapped.

- [ ] **Step 3: Create Source Fetch API**
Implement `app/api/sources/[id]/route.ts` to mock/fetch source text from Pinecone metadata.

- [ ] **Step 4: Connect Chip to Bottom-Sheet**
Add tapping logic to the citation chip to trigger the sheet and fetch data.

---

### Task 5: Backend Integration and Streaming

**Files:**
- Create: `app/api/chat/route.ts`
- Modify: `lib/pinecone.ts` (if needed)

- [ ] **Step 1: Implement AI SDK Route Handler**
Create `app/api/chat/route.ts` to process queries, fetch from Pinecone, and stream text using `streamText`.

- [ ] **Step 2: Integrate Images/Citations into Prompt**
Ensure the system prompt instructs the model to use `![[ref:ID]]` and `[Citation: ID]` markers.

- [ ] **Step 3: Verify Streaming and UI Interaction**
Run `npm run dev` and perform a live query to verify the full flow (Text -> Card -> Lightbox).
