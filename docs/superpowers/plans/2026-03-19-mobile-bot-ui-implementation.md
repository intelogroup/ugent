# Mobile-First Medical Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, ChatGPT-style chat interface for medical textbook querying with inline reference cards and citations.

**Architecture:** Next.js App Router with Vercel AI SDK for streaming, Tailwind CSS for styling, and Framer Motion for animations.

**Tech Stack:** Next.js 15, Tailwind CSS, Lucide Icons, Framer Motion, Vercel AI SDK, Pinecone, Playwright.

---

### Task 1: Setup Core UI Structure and Theme
**Files:** `app/layout.tsx`, `app/globals.css`, `components/ui/header.tsx`, `components/ui/drawer.tsx`
- [ ] Configure global styles for mobile-first (`h-screen`, clean typography).
- [ ] Implement Sticky Header with Menu, Bot Title, and SquarePen icons.
- [ ] Implement Slide-out Navigation Drawer with History/Settings.
- [ ] Integrate into layout.

### Task 2: Implement Chat Interface and Message Bubbles
**Files:** `components/chat/chat-interface.tsx`, `components/chat/message-bubble.tsx`, `components/chat/input-bar.tsx`
- [ ] Create Message Bubble (User vs Bot styles).
- [ ] Create Auto-expanding Input Bar (`max-h-[200px]`).
- [ ] Assemble Chat Interface using `useChat`.
- [ ] Add Empty State with starter prompts.

### Task 3: Implement Medical Reference Cards and Lightbox
**Files:** `components/chat/reference-card.tsx`, `components/ui/lightbox.tsx`
- [ ] Create Reference Card (4:3 aspect, metadata).
- [ ] Implement Lightbox Modal with pinch-to-zoom.
- [ ] Update Message Bubble to parse `![[ref:IMG_ID]]`.

### Task 4: Implement Citations and Bottom-Sheet
**Files:** `components/chat/citation-chip.tsx`, `components/ui/bottom-sheet.tsx`, `app/api/sources/[id]/route.ts`
- [ ] Create Citation Chip.
- [ ] Implement Bottom-Sheet for source preview.
- [ ] Create Source Fetch API.

### Task 5: Backend Integration and Streaming
**Files:** `app/api/chat/route.ts`
- [ ] Implement AI SDK Route Handler with Pinecone RAG.
- [ ] Configure System Prompt for images/citations.

### Task 6: Validation and Deployment
**Files:** `playwright.config.ts`, `.vercel/project.json`
- [ ] **Step 1: UI Audit with Chrome DevTools**
Run `npm run dev` and use `chrome-devtools` to verify mobile responsiveness and accessibility.
- [ ] **Step 2: End-to-End Testing with Playwright**
Install Playwright and write basic tests for message sending and image expansion.
- [ ] **Step 3: Vercel Deployment**
Deploy to `ugent` project using the provided Vercel token.
