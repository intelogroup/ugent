# UGent MedBot — Platform Design Spec
**Date**: 2026-03-19
**Status**: Approved (v2 — post security + feasibility review)
**Approach**: Convex-first, phased rollout, minimally testable steps

---

## Overview

Transform UGent MedBot from a stateless USMLE chat app into a persistent multi-platform learning platform with user accounts, cross-platform messaging (web + Telegram + WhatsApp), Stripe freemium billing, and background AI research agents.

**Existing stack**: Next.js 15, React 19, AI SDK v4, Pinecone RAG, Telegram webhook, WhatsApp webhook, Resend email.
**New backbone**: Convex (DB + real-time + background jobs + auth).

---

## Prerequisites

- **Vercel Pro required before Phase 1**: existing `app/api/chat/route.ts` already has `maxDuration = 30`, which exceeds Hobby plan's 10s serverless limit. Upgrade before any deployment.
- **Convex deployments**: use separate dev/prod deployments. `npx convex dev` targets dev; `npx convex deploy` targets prod. Never run test billing events against production.
- **`@convex-dev/auth` version**: pin to a specific minor version (currently `0.0.x`). It is still on `labs.convex.dev` (experimental). On a breaking change, fallback is `get-convex/better-auth` or Clerk + Convex JWT verification.

---

## Architecture: Convex-First

Convex is the central nervous system. All platforms read/write through it. Webhook routes do one thing only: verify signature → enqueue to Convex. No AI work happens inside Next.js routes.

```
Web App (Next.js 15)
  └── Convex Client (real-time subscriptions)
        └── Convex DB (users, threads, messages, jobs)

Telegram webhook (Next.js route)
  → verify TELEGRAM_WEBHOOK_SECRET header
  → Convex mutation (enqueue message only, no AI work)

WhatsApp webhook (Next.js route)
  → verify X-Hub-Signature-256 HMAC (Meta APP_SECRET)
  → Convex mutation (enqueue message only, no AI work)

Stripe webhook (Next.js route)
  → verify stripe-signature header (stripe.webhooks.constructEvent)
  → Convex mutation (update user.plan)

Convex Actions (all AI work lives here):
  - Pinecone retrieval + LLM inference
  - Push results to Telegram Bot API
  - Push results to WhatsApp Cloud API

Convex Scheduled Functions:
  - Deep research jobs (user-triggered, async)
  - Daily digest cron → Workpool fan-out (not direct 1K scheduler calls)
```

---

## Data Model (Convex Schema)

### `users`
| Field | Type | Notes |
|---|---|---|
| `email` | string? | unique index; null for WhatsApp-only accounts |
| `telegramId` | string? | unique index; set when Telegram connected |
| `telegramUsername` | string? | for display |
| `whatsappPhone` | string? | unique index; set when WhatsApp connected |
| `plan` | `"trial" \| "pro" \| "expired"` | default: "trial" |
| `trialStartedAt` | number | timestamp, set on signup |
| `stripeCustomerId` | string? | set on first checkout |
| `planExpiresAt` | number? | set on subscription |
| `createdAt` | number | timestamp |

### `telegramConnectTokens`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | which user initiated the connect |
| `token` | string | unique index; cryptographically random — `crypto.randomUUID()` minimum (128-bit entropy) |
| `expiresAt` | number | timestamp, 15 min from creation |
| `used` | boolean | marked true once redeemed; single-use enforced |

Index: `by_token` on `token`. Daily purge job cleans expired/used rows.

### `threads`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | owner |
| `platform` | `"web" \| "telegram" \| "whatsapp"` | origin |
| `title` | string? | auto-generated from first message; editable |
| `archivedAt` | number? | null = active; set to timestamp to archive |
| `createdAt` | number | |
| `updatedAt` | number | updated on each message |

Index: `by_user` on `["userId", "updatedAt"]`.

### `messages`
| Field | Type | Notes |
|---|---|---|
| `threadId` | Id<"threads"> | parent thread |
| `role` | `"user" \| "assistant"` | |
| `content` | `string \| ContentPart[]` | union type — supports plain text and future multi-part (image uploads, voice) |
| `imageAnnotations` | array? | Pinecone image results |
| `model` | string? | which model was used |
| `createdAt` | number | |

Index: `by_thread` on `["threadId", "createdAt"]` — required to avoid full table scans.

### `jobs`
| Field | Type | Notes |
|---|---|---|
| `userId` | Id<"users"> | owner |
| `type` | `"research" \| "digest"` | job type |
| `researchTopic` | string | the research query (renamed from `query`) |
| `status` | `"pending" \| "running" \| "done" \| "failed"` | |
| `result` | string? | completed result text |
| `createdAt` | number | |
| `completedAt` | number? | |

---

## Phase 1 — Convex + Email OTP Auth + Persistent Web Chat

**Goal**: Users can sign up, log in, and have chat history persist across sessions.

### Auth (Convex Auth — Email OTP)
- Package: `@convex-dev/auth` — **pin to specific minor version** at install time
- Provider: `Email` using Resend (already in deps) as OTP transport
- Known limitation: `convexAuthNextjsMiddleware` has an active bug (#271) where `isAuthenticated()` returns `false` in middleware for OAuth flows. Email OTP is unaffected. Do not add OAuth providers until this is resolved.
- `convexAuthNextjsMiddleware` in `middleware.ts` protects all routes except `/login`
- Login page: email input → OTP code input → redirect to `/`

### Chat persistence
- On user message: Convex mutation saves user message before streaming
- After stream complete: Convex mutation saves assistant message + image annotations
- On mount: `useQuery(api.messages.list, { threadId })` loads history
- Thread auto-created on first message if none exists for `platform: "web"`
- The message mutation itself checks trial status — unanswered messages are not written if plan is expired

### What stays unchanged
Pinecone retrieval, model routing (high-confidence vs low-confidence path), image annotations, streaming UX — all identical.

### Testable milestone
Sign up with email → verify OTP → ask a question → close browser → reopen → full history intact.

---

## Phase 2 — Connect Telegram + WhatsApp Signature Fix

**Goal**: Signed-in web users link their Telegram account. WhatsApp webhook gets proper HMAC verification (security prerequisite for Phase 3+).

### 2a — WhatsApp webhook HMAC fix (do this first)

The existing `POST /api/whatsapp/webhook` handler has **no signature verification**. This must be fixed before linking any user identity to WhatsApp messages.

Implementation:
```
1. Extract X-Hub-Signature-256 header
2. Compute HMAC-SHA256 of raw request body using META_APP_SECRET
3. Compare with header value using timing-safe comparison
4. Return 403 if mismatch — never process the payload
```

### 2b — Telegram connect flow
1. Settings page → "Connect Telegram" button
2. Convex mutation creates row in `telegramConnectTokens` (`crypto.randomUUID()`, 15-min TTL)
3. Displays: "Message `/connect <token>` to @Ugentmed3_bot"
4. Bot webhook receives `/connect <token>` → validates token (check expiry + used flag) → writes `telegramId` to user → marks token `used: true`
5. **On invalid/expired token**: bot replies "This link has expired. Go back to the app and generate a new one." — never silent failure.
6. User sees confirmation in Telegram + Settings page updates (real-time via Convex subscription)

### Webhook architecture change
Both Telegram and WhatsApp webhook routes now **only verify + enqueue**. No AI work inside the route:
```
POST /api/telegram/webhook
  1. Verify X-Telegram-Bot-Api-Secret-Token header (MUST be preserved from existing code)
  2. Convex mutation: create message record, schedule AI action
  3. Return 200 immediately

POST /api/whatsapp/webhook
  1. Verify X-Hub-Signature-256 HMAC
  2. Convex mutation: create message record, schedule AI action
  3. Return 200 immediately
```
All AI inference (Pinecone + LLM + reply push) happens inside the Convex Action, not the Next.js route.

### Web UI addition
Thread switcher: "Web" and "Telegram" tabs in chat interface.

### Testable milestone
Web user connects Telegram → sends question via bot → opens web app → sees conversation in Telegram tab in real-time.

---

## Phase 3 — Stripe Freemium

**Goal**: 1-month free trial on signup. Paywall after trial ends. Stripe subscription for Pro access.

### Trial logic
- `trialStartedAt` set on user creation
- Both the Convex mutation (message write) and the AI Action check: `plan === "pro"` OR `plan === "trial" && now < trialStartedAt + 30days`
- On block: return `{ error: "trial_expired" }` → client shows paywall modal

### Stripe integration (via Convex HTTP Actions — official Convex pattern)
- **Checkout**: Convex HTTP Action creates Stripe Checkout Session → returns URL → client redirects
- **Webhook handler** (`/api/stripe/webhook` Next.js route):
  - **MUST** call `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` — without this any POST can grant Pro access
  - `checkout.session.completed` → mutation sets `plan = "pro"`, `planExpiresAt`
  - `customer.subscription.updated` → mutation updates `planExpiresAt`
  - `invoice.payment_failed` → mutation sets `plan = "expired"` after grace period
  - `customer.subscription.deleted` → mutation sets `plan = "expired"`
- **Customer portal**: Convex HTTP Action creates Stripe Portal Session

### Pricing note
Convex Pro at $25/mo covers function call volume for 1K users. However, **compute overages apply** — each research agent job (Phase 4) consumes compute. Monitor the Convex dashboard and model average action duration before Phase 4 launch. Use separate Stripe webhook endpoints for dev vs prod environments.

### UI
- Paywall modal: "Your free trial has ended — upgrade to continue"
- Header shows trial days remaining (e.g. "12 days left in trial")

### Testable milestone
Manually set `trialStartedAt` to 31 days ago in Convex dashboard → send message → see paywall → complete Stripe test checkout → message works.

---

## Phase 4 — Research Agents (Async Push)

**Goal**: AI research jobs run asynchronously and push results to all connected channels regardless of whether the user is online. Gated behind Pro plan (Phase 3 shipped first).

### Mode A — Regular chat async push
All messages from Telegram/WhatsApp trigger Convex Actions (not Next.js routes — already changed in Phase 2):
- Convex Action: Pinecone + LLM → save response → push to originating platform API
- Web app gets update via subscription if open

### Mode B — Deep Research (user-triggered, Pro only)
- User types `/research <topic>` or clicks Research button
- Convex mutation creates job record (`status: "pending"`) — checks plan guard
- Schedules a Convex Action
- Action: Tavily search + Pinecone + LLM synthesis (`@tavily/core` already in deps)
- On completion: saves result → pushes to ALL connected channels
- Web shows notification badge

### Mode C — Proactive daily digest (Pro only)
- Convex cron (`daily at 8am UTC`)
- **Uses Convex Workpool component** (`@convex-dev/workpool`) for fan-out — do NOT use direct `ctx.scheduler` to schedule 1K actions. Convex's hard limit is 1000 scheduled functions per function invocation — zero growth headroom and no batching/rate-limiting for external APIs.
- Workpool processes users in configurable batches with rate limiting
- Each per-user job: LLM generates USMLE fact → saves to thread → pushes to connected channels
- **Replaces** existing Telegram facts cron (cron-job.org) and WhatsApp facts cron

### Testable milestone
Click Research on web → close browser → receive result on Telegram ~30 seconds later.

---

## Phase 5 — WhatsApp OTP Login

**Goal**: Alternative login for users who prefer WhatsApp over email.

### Flow
1. Login page: "Sign in with WhatsApp" → phone number input
2. **Send-side rate limit FIRST**: check Upstash Redis (or Convex rate-limiter component) — max 3 OTP sends per phone number per 10 minutes. Return error without calling WhatsApp API if exceeded.
3. Convex Auth `Phone` provider → custom send function → calls WhatsApp Business API with OTP
4. User enters 6-digit code → Convex Auth verifies (built-in: 10 failed attempts/hour lockout)
5. If phone matches existing `whatsappPhone` (unique index lookup) → link to that account
6. If no match → create new WhatsApp-only account (`email: null`)
7. **Duplicate account handling**: post-login, check if a separate email account exists with matching data → prompt "We found an account registered with email. Would you like to merge?"

### Requirements
- Meta WhatsApp Business API approved account
- Approved message template: "Your UGent MedBot verification code is {{1}}. Valid for 10 minutes."
- Template approval: 1–2 business days with Meta
- Upstash Redis (or `@convex-dev/rate-limiter`) for send-side throttling

### Testable milestone
Open login page → enter WhatsApp number → OTP throttled after 3 attempts → receive OTP via WA → log in successfully.

---

## Security Checklist

All of these must be verified before each phase ships:

| Check | Phase | Status |
|---|---|---|
| Stripe `stripe-signature` verification in webhook handler | 3 | Required |
| WhatsApp `X-Hub-Signature-256` HMAC verification | 2 | Required (existing code broken) |
| Telegram `X-Telegram-Bot-Api-Secret-Token` check preserved in rewrite | 2 | Required |
| Convex Auth OTP verify-side rate limit (10/hr, built-in) | 1 | Built-in |
| WhatsApp OTP send-side rate limit (3/10min, custom) | 5 | Required |
| Telegram connect token: `crypto.randomUUID()` entropy | 2 | Required |
| Telegram connect token: single-use (`used` flag) | 2 | Required |
| Trial/plan check in Convex mutation (not just Action) | 3 | Required |
| Webhook routes return 200 before AI work (no timeout risk) | 2 | Required |

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| DB + backend | Convex | Real-time, background jobs, auth — all built in |
| Auth | `@convex-dev/auth` (pinned) | Email OTP via Resend; fallback: `get-convex/better-auth` |
| Background jobs | Convex Scheduled Actions | No Inngest, no external queue |
| Cron fan-out | Convex Workpool component | Hard 1K limit on direct scheduler calls; Workpool handles batching |
| Real-time | Convex subscriptions | No Pusher, no Ably |
| Payments | Stripe via Convex HTTP Actions | Official Convex pattern, first-party template exists |
| Research tool | Tavily (already in deps) | Web search for deep research jobs |
| Email transport | Resend (already in deps) | OTP delivery for Convex Auth |
| Onboarding channel | Web only | Telegram/WhatsApp are connected channels, not signup paths |
| Vercel plan | Pro required | `maxDuration = 30` already in codebase |

---

## What Is NOT in Scope

- Google / GitHub OAuth (avoid until Convex Auth middleware bug #271 is resolved)
- Mobile app
- Admin dashboard
- Multi-language support
- Advanced analytics
- Team/organization accounts
