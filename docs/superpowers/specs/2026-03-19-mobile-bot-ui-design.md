# Design Spec: Mobile-First ChatGPT-Style UI for MedBot

This document specifies the UI/UX design for the UGent Medical Bot, focusing on a mobile-first, hybrid interface that mimics the ChatGPT experience with specialized medical reference cards.

## 1. Goal
Provide a familiar, intuitive, and responsive chat interface that seamlessly integrates medical textbook images and citations into the conversational flow.

## 2. UI Components

### 2.1 Global Layout
- **Container:** A full-height, flexbox-based layout optimized for mobile viewports.
- **Header:** Sticky top bar containing a hamburger menu (history), bot identity ("UGent MedBot 3.5"), and a "New Chat" icon.
- **Background:** Clean white (#FFFFFF) background for the chat area to maximize readability of medical text.

### 2.2 Message Bubbles
- **User Message:** Right-aligned, rounded-2xl bubbles with a light gray background (#F3F4F6) and dark text.
- **Bot Message:** Left-aligned with a circular avatar (emerald-600 background). No bubble background; text is laid out directly on the white background for a modern feel.
- **Typography:** System-native sans-serif font stack. Leading-relaxed (1.625) for medical descriptions.

### 2.3 Medical Reference Cards (Hybrid Element)
- **Structure:** Inline cards embedded within bot responses.
- **Visuals:** 
  - Bordered container with rounded-xl corners.
  - Aspect-ratio (4:3) image placeholder/container with a light gray-200 background.
  - Bottom metadata section containing:
    - Label: "REFERENCE" (uppercase, tracking-wider).
    - Image Title: (e.g., "Pathoma Fig 4.2").
    - Short Description: A one-line preview of what the image shows.
- **Interaction:** Tap-to-expand/zoom feature for full-screen viewing of diagrams.

### 2.4 Citation Chips
- Small, pill-shaped buttons at the bottom of bot messages.
- Format: Book Name + Page Number (e.g., "First Aid 2023, p. 412").
- Visual: Light gray-50 background, gray-500 text, thin border.

### 2.5 Sticky Input Area
- **Container:** Pinned to the bottom with a subtle white-to-transparent gradient above it.
- **Input Bar:** 
  - Rounded-3xl container with a shadow-sm and gray-300 border.
  - "Plus" icon on the left for future attachments.
  - Auto-expanding textarea for multi-line queries.
  - Circular "Send" button (gray-900) with a white upward arrow.

## 3. Tech Stack Integration
- **Framework:** Next.js + Tailwind CSS.
- **Icons:** Lucide-React.
- **Animation:** Framer Motion for message entry and card expansion.
- **Markdown:** `react-markdown` for rendering formatted medical text (bolding, lists, etc.).

## 4. Success Criteria
- [ ] UI is pixel-perfect on mobile browsers (Chrome/Safari).
- [ ] Images render as structured cards rather than raw <img> tags.
- [ ] Input area correctly handles long queries without breaking the layout.
- [ ] Citations are clearly linked to bot responses.
