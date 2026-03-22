# UGent — Roadmap

Focus: build the full study loop for medical students — ask questions, get answers, test knowledge, track progress. Source material: First Aid 2023 and Pathoma 2021.

---

## P0 — Journey Blockers (ship these first)

- [x] **Chat UI with source attribution** — chat page exists but answers should cite the chapter and book (e.g., "First Aid Ch. 3 — Cardiology"); without this, answers are untrustworthy
- [x] **Search/browse interface** — let students browse by organ system or chapter before asking; pure Q&A without context navigation is disorienting
- [x] **User dashboard** — a home screen after login: recent chats, bookmarked chapters, daily fact if subscribed
- [x] **Auth state guard** — protect all app routes; currently login page exists but route protection is unclear
- [ ] **Image display in answers** — embed_images.py is built; wire image retrieval into chat responses for diagrams and tables

---

## P1 — User Journey Completeness

- [ ] **Bookmark / save** — star a Q&A pair or chapter section to review later; stored in Convex per user
- [ ] **Spaced repetition queue** — saved items surface as flashcard-style review prompts; simple interval logic only
- [ ] **Chapter outline navigator** — sidebar listing First Aid and Pathoma chapters; click to ask questions scoped to that chapter
- [ ] **Daily fact push** — cron already sends facts via Telegram/WhatsApp; add opt-in to web notifications too
- [ ] **Chat history** — per-user conversation log; student can return to a prior session and continue
- [ ] **Confidence rating** — after each answer, student taps "got it / unsure / wrong"; used to surface weak areas

---

## P2 — Quality of Life

- [ ] **Quick quiz mode** — generate 5 MCQs from a selected chapter; Convex action calls LLM with chapter context
- [ ] **Progress heatmap** — which chapters/topics has the student engaged with most; simple counts, no ML
- [ ] **WhatsApp / Telegram onboarding link** — connect existing bot delivery to web account with QR code
- [ ] **Dark mode** — long study sessions; wire up Tailwind dark class toggle

---

## Out of Scope (do not build)

- Adding new medical textbooks without explicit owner approval (embedding pipeline is expensive)
- Full LMS / course builder for educators
- Video content or lecture notes
- Collaborative study rooms
- Non-medical subject matter
