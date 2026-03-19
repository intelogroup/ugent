# Design Spec: Mobile-First ChatGPT-Style UI for MedBot

This document specifies the UI/UX design for the UGent Medical Bot, focusing on a mobile-first, hybrid interface that mimics the ChatGPT experience with specialized medical reference cards.

## 1. Goal
Provide a familiar, intuitive, and responsive chat interface that seamlessly integrates medical textbook images and citations into the conversational flow.

## 2. UI Components

### 2.1 Global Layout
- **Container:** A full-height, flexbox-based layout optimized for mobile viewports (`h-screen`).
- **Header:** Sticky top bar (`h-14`) containing:
  - **Menu Icon (`Menu`):** Triggers a left-aligned slide-out drawer.
  - **Bot Identity:** "UGent MedBot 3.5" (centered, semibold).
  - **New Chat Icon (`SquarePen`):** Clears current session state.
- **Empty State:** Before the first message, show a centered "Hero" section with the Bot Icon and 3 "Starter Prompts" (e.g., "Explain Heparin's MOA", "Pathology of Type II Diabetes").

### 2.2 Navigation Drawer (Slide-out)
- **Chat History:** Grouped by date (Today, Yesterday, Last 7 Days). Each item is a link with a truncated message title.
- **Settings Section:**
  - **Theme Toggle:** Switch between Light and Dark mode.
  - **Model Selection:** Dropdown to choose between `gpt-4o` and `claude-3.5-sonnet`.
- **Visuals:** Semi-transparent overlay (`backdrop-blur`) behind the drawer.

### 2.3 Message Bubbles
- **User Message:** Right-aligned, rounded-2xl bubbles with a light gray background (#F3F4F6) and dark text.
- **Bot Message:** Left-aligned with a circular avatar (emerald-600 background, `Bot` icon). 
  - **Avatar:** Pulses during the "Thinking" state.
- **Markdown:** Supports bolding, lists, and tables via `react-markdown`.

### 2.4 Medical Reference Cards (Hybrid Element)
- **Structure:** Inline cards triggered by `![[ref:IMG_ID]]`.
- **Visuals:** 
  - **Image Fitting:** Uses `object-contain` within a 4:3 container.
  - **Metadata:** "REFERENCE" label + Image Title + 1-line description.
- **Expanded State (Lightbox):** 
  - Full-screen modal with black semi-transparent background.
  - Diagram is shown at max resolution with pinch-to-zoom support.
  - Close button (`X`) in top-right.

### 2.5 Citation Chips
- Small, pill-shaped buttons at bottom of bot messages.
- **Interaction:** Tapping a chip opens a **Bottom-Sheet**.
- **Data Flow:** The sheet fetches the full source text snippet asynchronously by ID via `GET /api/sources/[id]`.
- **Loading State:** Show a skeleton loader inside the bottom-sheet while fetching.

### 2.6 Sticky Input Area
- **Container:** Pinned to bottom with a white gradient.
- **Input Bar:** 
  - Rounded-3xl container with `Plus` icon (left) and `Send` button (right).
  - **Max Height:** Auto-expands up to `max-h-[200px]` before enabling internal scrolling.

## 3. Tech Stack Integration
- **Framework:** Next.js + Tailwind CSS.
- **Icons:** Lucide-React.
- **Animation:** Framer Motion (Drawer, Lightbox, Bottom-sheet).
- **State:** `jotai` or `zustand` for drawer and theme state.

## 4. Success Criteria
- [ ] UI is pixel-perfect on mobile browsers.
- [ ] Images and citations have clear loading/interaction states.
- [ ] Drawer correctly manages history and settings.
- [ ] Empty state provides immediate utility.
