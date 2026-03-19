# UGent MedBot — Platform Design Spec
**Date**: 2026-03-19
**Status**: Approved
**Approach**: Convex-first, phased rollout, minimally testable steps

---

## Overview

Transform UGent MedBot from a stateless USMLE chat app into a persistent multi-platform learning platform with user accounts, cross-platform messaging (web + Telegram + WhatsApp), background AI research agents, and Stripe freemium billing.

**Existing stack**: Next.js 15, React 19, AI SDK v4, Pinecone RAG, Telegram webhook, WhatsApp webhook, Resend email.
**New backbone**: Convex (DB + real-time + background jobs + auth).

---

## Architecture: Convex-First

Convex is the central nervous system. All platforms read/write through it.

```
Web App (Next.js 15)
  └── Convex Client (real-time subscriptions)
        └── Convex DB (users, threads, messages, jobs)

Telegram webhook (Next.js route) ──→ Convex mutation ──→ Convex DB
WhatsApp webhook (Next.js route) ──→ Convex mutation ──→ Convex DB

Convex Actions:
  - Pinecone retrieval + LLM inference
  - Push results to Telegram Bot API
  - Push results to WhatsApp Cloud API

Convex Scheduled Functions:
  - Deep research jobs (user-triggered, async)
  - Daily digest cron (replaces existing vercel.json crons)

Stripe webhooks (Next.js route) ──→ Convex mutation ──→ update user.plan
```

---

## Data Model (Convex Schema)

### `users`
| Field | Type | Notes |
|---|---|---|
| `email` | string | unique, required |
| `telegramId` | string? | set when Telegram connected |
| `telegramUsername` | string? | for display |
| `whatsappPhone` | string? | set when WhatsApp connected; unique index |
| `plan` | `"trial" \| "pro" \| "expired"` | default: "trial" |
| `trialStartedAt` | number | timestamp, set on signup |
| `stripeCustomerId` | string? | set on first checkout |
| `planExpiresAt` | number? | set on subscription |
| `createdAt` | number | timestamp |

### `telegramConnectTokens`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | which user initiated the connect |
| `token` | string | unique random token |
| `expiresAt` | number | timestamp, 15 min from creation |
| `used` | boolean | marked true once redeemed |

Index: `by_token` on `token` for fast lookup. Expired/used tokens are cleaned up by a scheduled purge job (daily).

### `threads`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | owner |
| `platform` | `"web" \| "telegram" \| "whatsapp"` | origin |
| `createdAt` | number | |
| `updatedAt` | number | updated on each message |

### `messages`
| Field | Type | Notes |
|---|---|---|
| `threadId` | Id<"threads"> | parent thread |
| `role` | `"user" \| "assistant"` | |
| `content` | string | text content |
| `imageAnnotations` | array? | Pinecone image results |
| `model` | string? | which model was used |
| `createdAt` | number | |

### `jobs`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | owner |
| `type` | `"research" \| "digest"` | job type |
| `query` | string | research topic |
| `status` | `"pending" \| "running" \| "done" \| "failed"` | |
| `result` | string? | completed result text |
| `createdAt` | number | |
| `completedAt` | number? | |

---

## Phase 1 — Convex + Email OTP Auth + Persistent Web Chat

**Goal**: Users can sign up, log in, and have chat history persist across sessions.

### Auth (Convex Auth — Email OTP)
- Provider: `Email` from `@convex-dev/auth` using Resend (already in deps) as transport
- `convexAuthNextjsMiddleware` in `middleware.ts` protects all routes except `/login`
- Login page: email input → OTP code input → redirect to `/`

### Chat persistence
- On user message: `useMutation(api.messages.create)` saves user message before streaming
- After stream complete: `useMutation(api.messages.create)` saves assistant message + image annotations
- On mount: `useQuery(api.messages.list, { threadId })` loads history (replaces stateless current behavior)
- Thread auto-created on first message if none exists for `platform: "web"`

### What stays unchanged
Pinecone retrieval, model routing (project-specific model versions: high-confidence path vs low-confidence path), image annotations, streaming UX — all identical.

### Testable milestone
Sign up with email → verify OTP → ask a question → close browser → reopen → full history intact.

---

## Phase 2 — Connect Telegram to Account

**Goal**: Signed-in web users can link their Telegram account. Messages to/from the bot are saved to their account and visible in the web app.

### Connect flow
1. Settings page → "Connect Telegram" button
2. Generates a short-lived token (Convex mutation, creates row in `telegramConnectTokens` with 15-min TTL)
3. Displays: "Message `/connect <token>` to @Ugentmed3_bot"
4. Bot webhook receives `/connect <token>` → validates token → writes `telegramId` to user
5. User sees confirmation in Telegram + Settings page updates (real-time via Convex subscription)

### Cross-platform thread
Existing `/api/telegram/webhook/route.ts` upgraded:
1. Looks up user by `telegramId` in Convex
2. Saves message to their `telegram` thread via mutation
3. Calls `/api/chat` internally for AI response → saves response to thread
4. Calls Telegram Bot API to send reply back
5. Web app Telegram tab updates in real-time

### Web UI addition
Thread switcher: "Web" tab and "Telegram" tab in chat interface. Both show their respective threads.

### Testable milestone
Web user connects Telegram → sends question via bot → opens web app → sees the conversation in Telegram tab in real-time.

---

## Phase 3 — Research Agents (Async Push)

**Goal**: AI research jobs run asynchronously and push results to all connected channels regardless of whether the user is online.

### Mode A — Regular chat async push
When a message arrives from Telegram or WhatsApp (not web):
- Convex mutation saves message
- Convex Action runs: Pinecone + LLM → saves response
- Action calls Telegram Bot API or WhatsApp Cloud API to deliver reply
- Web app updates via subscription (if open)

### Mode B — Deep Research (user-triggered)
- User types `/research <topic>` or clicks Research button in web app
- Convex mutation creates job record (`status: "pending"`)
- Mutation schedules a Convex Action (via `ctx.scheduler.runAfter(0, ...)`)
- Action runs: Tavily search + Pinecone + LLM synthesis (uses `@tavily/core`, already in deps)
- On completion: saves result → pushes to ALL connected channels (web notification + Telegram + WhatsApp)
- Web shows notification badge; job result appears in thread

### Mode C — Proactive daily digest
- Convex cron (`daily at 8am UTC`): fans out via `ctx.scheduler` — schedules one Action **per user** (not a monolithic loop) to avoid hitting Convex 10-minute Action wall-clock limit
- Each per-user Action: generates a USMLE fact using LLM → saves to thread → pushes to connected channels
- **Replaces** existing Telegram facts cron (currently on cron-job.org) and WhatsApp facts cron

### Testable milestone
Click Research on web → close browser → receive result on Telegram ~30 seconds later.

---

## Phase 4 — Stripe Freemium

**Goal**: 1-month free trial on signup. Paywall after trial ends. Stripe subscription for Pro access.

### Trial logic
- `trialStartedAt` set on user creation
- Every message request checks: `plan === "pro"` OR `plan === "trial" && now < trialStartedAt + 30days`
- Check happens in Convex Action (server-side, not client)
- On block: return `{ error: "trial_expired" }` → client shows paywall modal

### Stripe integration
- **Checkout**: Convex HTTP Action creates Stripe Checkout Session → returns URL → client redirects
- **Success webhook** (`/api/stripe/webhook`): `checkout.session.completed` → mutation sets `plan = "pro"`, `planExpiresAt`
- **Renewal webhook**: `customer.subscription.updated` → mutation updates `planExpiresAt`
- **Payment failure webhook**: `invoice.payment_failed` → mutation sets `plan = "expired"` after grace period
- **Cancellation webhook**: `customer.subscription.deleted` → mutation sets `plan = "expired"`
- **Customer portal**: Convex HTTP Action creates Stripe Portal Session for plan management

### UI
- Paywall modal: "Your free trial has ended" + "Upgrade — $X/mo" button → triggers Stripe Checkout
- Header shows trial days remaining while in trial (e.g. "12 days left in trial")

### Testable milestone
Manually set `trialStartedAt` to 31 days ago in Convex dashboard → send message → see paywall → complete Stripe test checkout → message works.

---

## Phase 5 — WhatsApp OTP Login

**Goal**: Alternative login method for users who prefer WhatsApp over email.

### Flow
1. Login page: "Sign in with WhatsApp" → phone number input
2. Convex Auth `Phone` provider → custom send function → calls WhatsApp Business API with OTP message
3. User enters 6-digit code → Convex Auth verifies → session set
4. If phone matches existing `whatsappPhone` on a user record → links to that account
5. If new phone → creates new account with no email (WhatsApp-only user)

### Requirements
- Meta WhatsApp Business API approved account
- Approved message template: "Your UGent MedBot verification code is {{1}}. Valid for 10 minutes."
- Template approval: 1–2 business days with Meta

### Testable milestone
Open login page → enter WhatsApp number → receive OTP via WA message → log in successfully.

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| DB + backend | Convex | Real-time, background jobs, auth — all built in. $25/mo covers 1K users |
| Auth | Convex Auth | Free, lives in Convex, Next.js 15 first-class, email OTP via Resend |
| Background jobs | Convex Scheduled Actions | No Inngest, no external queue |
| Real-time | Convex subscriptions | No Pusher, no Ably |
| Payments | Stripe | Standard, Vercel Marketplace, well-documented |
| Research tool | Tavily (already in deps) | Web search for deep research jobs |
| Email transport | Resend (already in deps) | OTP delivery for Convex Auth |
| Onboarding channel | Web only | Telegram/WhatsApp are connected channels, not signup paths |

---

## What Is NOT in Scope

- Google / GitHub OAuth (can add later, trivial with Convex Auth)
- Mobile app
- Admin dashboard
- Multi-language support
- Advanced analytics
- Team/organization accounts
