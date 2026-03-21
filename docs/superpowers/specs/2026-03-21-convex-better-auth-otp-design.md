# Convex + Better Auth: Reliable OTP Auth & User Persistence

**Date:** 2026-03-21
**Project:** `~/Developer/ugent` (Next.js 15 + Convex + `@convex-dev/better-auth` v0.11.3)
**Status:** Approved — ready for implementation planning

---

## Problem Statement

The current email OTP auth flow has four distinct bugs causing login failures, session loss, and broken user data:

| # | Bug | Symptom |
|---|-----|---------|
| 1 | `CORS: "*"` with `credentials: true` | Browser silently rejects Set-Cookie header → session never stored → user logged out on every refresh |
| 2 | `EmailOtpForm` uses `try/catch` instead of `{ data, error }` | Client throws even on success; fallback `getSession()` hack added to compensate |
| 3 | No `triggers.user.onCreate` configured | Better Auth creates a user (UUID string) but the custom `users` table is never seeded → `jobs.userId` (Convex ID) breaks on first job creation |
| 4 | `BETTER_AUTH_SECRET` not confirmed on Convex deployment | Sessions created without signing key → invalidated on redeploy; all users logged out |

---

## Approach: Targeted Fixes

Fix only the four root causes. Minimal change surface. All changes are test-first (TDD — tests written and failing before implementation begins).

**Rejected alternatives:**
- Approach B (full `convexBetterAuthNextJs` migration): 8+ file changes for no functional gain over targeted fixes once CORS is corrected.
- Approach C (client-side upsert): Not atomic — a network failure between sign-in and upsert leaves the user permanently broken.

---

## Architecture

### Files Changed

```
convex/auth.ts                          ← add triggers config + authFunctions export
convex/http.ts                          ← fix CORS: SITE_URL (required), not "*"
convex/schema.ts                        ← add authId: v.optional(v.string()) + by_auth_id index to users
components/auth/email-otp-form.tsx      ← rewrite to { data, error } pattern; remove catch hacks
```

### New Test Files

```
__tests__/auth-trigger.test.ts          ← convex-test: onCreate trigger unit tests
__tests__/auth-form.test.tsx            ← React Testing Library: OTP form state tests
__tests__/auth-cors.test.ts             ← unit: CORS header correctness
```

### No-change files

- `convex/users.ts` — no changes needed; trigger uses `ctx.db.insert` directly
- `convex/auth.config.ts` — no changes needed
- `lib/auth-client.ts` — no changes needed
- `app/login/page.tsx` — no changes needed (uses `EmailOtpForm` via props)

---

## Data Model Changes

### `convex/schema.ts` — `users` table

Add `authId` as `v.optional(v.string())`. Convex supports sparse indexes over optional fields — rows with `authId: undefined` are excluded from the index automatically.

```typescript
users: defineTable({
  email: v.optional(v.string()),
  authId: v.optional(v.string()),          // NEW: Better Auth user _id (string UUID)
  telegramId: v.optional(v.string()),
  telegramUsername: v.optional(v.string()),
  whatsappPhone: v.optional(v.string()),
  plan: v.union(v.literal("trial"), v.literal("pro"), v.literal("expired")),
  trialStartedAt: v.number(),
  stripeCustomerId: v.optional(v.string()),
  planExpiresAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_auth_id", ["authId"])         // NEW — sparse index, safe for existing rows
  .index("by_telegram_id", ["telegramId"])
  .index("by_whatsapp_phone", ["whatsappPhone"]),
```

**Existing row safety:** All current `users` rows have `authId: undefined`. The sparse index silently excludes them. No migration needed. No existing query, mutation, or validator references `authId` today — confirmed by codebase search.

**`threads.userId` stays `v.string()`** (Better Auth UUID) — Phase 2 migration. Threads remain queryable by `userId` string after this change; no join query breaks. Phase 2 will add a `by_convex_user` index and migrate existing thread rows.

**`jobs.userId` stays `v.id("users")`** — works correctly after trigger is in place (trigger creates the `users` row before any job can be created).

---

## Component Designs

### 1. `convex/auth.ts` — Triggers

`authComponent.setUserId(ctx, authUserId, convexUserId)` is a method on the `createClient` result. It writes the Convex user ID (`v.id("users")`) into the Better Auth component's internal storage, linking the two records. This means `authComponent.getAuthUser(ctx)` will return the full Convex `users` document instead of just the Better Auth user — enabling type-safe server-side user access.

The `user.onCreate` trigger runs inside the **same Convex transaction** as user creation. If it throws, the entire user creation rolls back atomically.

```typescript
import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { internal } from "./_generated/api";

// AuthFunctions must be declared before createClient so triggers can call internal functions
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        // Insert into custom users table with trial plan defaults
        const userId = await ctx.db.insert("users", {
          email: authUser.email ?? undefined,
          authId: authUser._id,             // string UUID from Better Auth
          plan: "trial",
          trialStartedAt: Date.now(),
          createdAt: Date.now(),
        });
        // Link: tell Better Auth component which Convex user ID to return from getAuthUser()
        await authComponent.setUserId(ctx, authUser._id, userId);
      },
      onUpdate: async (ctx, newAuthUser, prevAuthUser) => {
        // Sync email changes from Better Auth → custom users table
        if (newAuthUser.email !== prevAuthUser.email) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q) => q.eq("authId", newAuthUser._id))
            .unique();
          if (user) {
            await ctx.db.patch(user._id, { email: newAuthUser.email ?? undefined });
          }
        }
      },
    },
  },
});

// Export trigger handlers — required by convex.config.ts
export const { onCreate, onUpdate } = authComponent.triggersApi();
```

**Failure mode:** If `ctx.db.insert("users", ...)` fails (e.g., schema validator mismatch), the entire Better Auth user creation rolls back. The user sees a sign-in error and can retry. No partial state.

### 2. `convex/http.ts` — CORS Fix

`SITE_URL` is **required** — throw at startup if absent. The `"*"` wildcard is invalid with `credentials: true` per the Fetch spec; browsers silently drop the `Set-Cookie` response header.

```typescript
const origin = process.env.SITE_URL;
if (!origin) {
  throw new Error("SITE_URL env var is required for CORS. Set it on the Convex deployment.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, better-auth.session_token",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};
```

**If `SITE_URL` is missing:** The HTTP action throws at request time, returning a 500 to the client. This is fail-fast — better than silently rejecting cookies in production.

### 3. `components/auth/email-otp-form.tsx` — `{ data, error }` Pattern

Remove all silent catches and the fallback `getSession()` call. Use the better-auth client's actual response shape.

```typescript
const handleEmailSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });
  if (error) {
    setError("Could not send code. Please try again.");
    setLoading(false);
    return;                               // Do NOT advance to OTP step on failure
  }
  setStep("otp");
  setLoading(false);
};

const handleOtpSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  const { data, error } = await authClient.signIn.emailOtp({ email, otp });
  if (error) {
    setError(error.message ?? "Invalid code. Please try again.");
    setLoading(false);
    return;
  }
  if (data) {
    onSuccess();
  }
  setLoading(false);
};
```

**Error type discrimination:**
- `error.status === 400` → invalid OTP → "Invalid code. Please try again."
- `error.status === 429` → rate limited → "Too many attempts. Please wait."
- Network error / other → "Something went wrong. Please try again."

### 4. `BETTER_AUTH_SECRET` — Deployment Prerequisite

**⚠ Breaking change:** Setting a new `BETTER_AUTH_SECRET` invalidates all existing sessions. Every logged-in user will be silently logged out on their next request. Plan for this during deployment.

```bash
# Set on Convex deployment (run once before any deploy)
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

**Rotation policy:** Only rotate if the secret is compromised. Rotation logs all users out.

---

## Test Plan (TDD — all tests written before implementation)

### `__tests__/auth-trigger.test.ts` — `convex-test`

Uses `convex-test` mock Convex backend. Tests run in vitest.

```
Test: "onCreate inserts a users row with plan trial"
  Input: Better Auth fires user onCreate with { _id: "auth_abc123", email: "test@example.com" }
  Assert: ctx.db.query("users").first() returns a row with plan === "trial"

Test: "onCreate sets trialStartedAt to current timestamp"
  Input: onCreate fires at time T
  Assert: users row trialStartedAt is within 1000ms of T

Test: "onCreate sets authId to the Better Auth user _id"
  Input: authUser._id = "auth_abc123"
  Assert: users row authId === "auth_abc123"

Test: "onCreate calls setUserId to link Convex ID back to Better Auth"
  Input: onCreate fires
  Assert: authComponent.setUserId called with (ctx, "auth_abc123", <new users Convex ID>)

Test: "onUpdate syncs email when Better Auth email changes"
  Input: prevAuthUser.email = "old@example.com", newAuthUser.email = "new@example.com"
  Assert: users row email updated to "new@example.com"

Test: "onUpdate does not patch users when email unchanged"
  Input: prevAuthUser.email = "same@example.com", newAuthUser.email = "same@example.com"
  Assert: ctx.db.patch never called

Test: "getCurrentUser returns null when no session present"
  Input: no auth token in ctx
  Assert: getCurrentUser query returns null
```

### `__tests__/auth-form.test.tsx` — React Testing Library

Mocks `authClient` from `@/lib/auth-client`.

```
Test: "renders email input on initial load"
  Assert: input[type=email] visible, OTP input not visible

Test: "shows loading state while sendVerificationOtp in flight"
  Mock: sendVerificationOtp hangs (unresolved promise)
  Assert: button text is "Sending…" and is disabled

Test: "advances to OTP step when sendVerificationOtp resolves with no error"
  Mock: sendVerificationOtp returns { data: {}, error: null }
  Assert: OTP input visible, email input not visible

Test: "stays on email step and shows error when sendVerificationOtp returns error"
  Mock: sendVerificationOtp returns { data: null, error: { message: "Resend failed" } }
  Assert: email input still visible, error text "Could not send code" shown

Test: "shows loading state while signIn.emailOtp in flight"
  Mock: signIn.emailOtp hangs
  Assert: button text is "Verifying…" and is disabled

Test: "calls onSuccess when signIn.emailOtp returns { data }"
  Mock: signIn.emailOtp returns { data: { user: {}, session: {} }, error: null }
  Assert: onSuccess spy called once

Test: "shows error message when signIn.emailOtp returns { error }"
  Mock: signIn.emailOtp returns { data: null, error: { message: "Invalid code", status: 400 } }
  Assert: error text "Invalid code" visible, onSuccess not called

Test: "shows rate limit message on 429 error"
  Mock: signIn.emailOtp returns { data: null, error: { status: 429 } }
  Assert: error text includes "Too many attempts"
```

### `__tests__/auth-cors.test.ts` — Unit

Pure function tests — extract CORS header logic to a testable helper.

```
Test: "CORS_HEADERS origin equals SITE_URL env var"
  Setup: process.env.SITE_URL = "https://example.com"
  Assert: CORS_HEADERS["Access-Control-Allow-Origin"] === "https://example.com"

Test: "CORS_HEADERS allows credentials"
  Assert: CORS_HEADERS["Access-Control-Allow-Credentials"] === "true"

Test: "throws if SITE_URL is not set"
  Setup: delete process.env.SITE_URL
  Assert: getCorsHeaders() throws Error("SITE_URL env var is required")
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `sendVerificationOtp` returns `{ error }` | Show "Could not send code." Stay on email step. Do NOT advance to OTP. |
| `signIn.emailOtp` returns `{ error.status === 400 }` | Show "Invalid code. Please try again." Stay on OTP step. |
| `signIn.emailOtp` returns `{ error.status === 429 }` | Show "Too many attempts. Please wait." Stay on OTP step. |
| `signIn.emailOtp` returns `{ error }` (other) | Show "Something went wrong. Please try again." |
| `signIn.emailOtp` returns `{ data }` | Call `onSuccess()` → router.push("/chat") |
| `user.onCreate` trigger throws | Better Auth user creation rolls back. User sees sign-in error. Can retry. |
| `SITE_URL` env var missing | HTTP action throws 500 at request time. Fail-fast, not silent. |
| `BETTER_AUTH_SECRET` missing | Sessions created but not signed → Convex invalidates silently. All users see auth errors. |

---

## Security Considerations

- **CORS hardening:** Specific origin replaces wildcard. `credentials: true` now functions correctly.
- **`BETTER_AUTH_SECRET` rotation:** Only rotate on compromise. Rotation is a breaking change (all sessions invalidated — plan a maintenance window or force re-login gracefully).
- **OTP expiry:** 600 seconds (10 min). Configured in `auth.ts`. Acceptable for this use case.
- **`authId` storage:** Stored as `v.optional(v.string())`, not a Convex document ID. No type confusion with `v.id("users")`.
- **No PII beyond email** in the trigger's insert.
- **`BETTER_AUTH_SECRET`** must never be committed to git or `.env.local`. Managed exclusively via `npx convex env set`.

---

## `BETTER_AUTH_SECRET` Breaking Change Notice

Setting `BETTER_AUTH_SECRET` for the first time (or rotating it) will log out all currently authenticated users on their next request. During the initial deployment of this fix:

1. All active sessions will be invalidated
2. Users will be redirected to `/login`
3. They must complete the OTP flow again to get a new session

This is expected and acceptable for a dev/staging environment. For production, schedule during low-traffic hours and communicate to users.

---

## Out of Scope (Phase 2)

- Migrating `threads.userId` from `v.string()` (Better Auth UUID) to `v.id("users")` (Convex ID). Phase 2 will add a `by_convex_user` index, write a migration script, and update all thread queries. Existing threads remain readable by string UUID after this change.
- WhatsApp/Telegram user linking to the `users` table
- Stripe/plan management flows
- Magic link auth as OTP fallback

---

## Convex-BA Skill

After implementation, a `convex-ba` Claude Code skill will be created capturing:

- Setup checklist (env vars, BETTER_AUTH_SECRET, CORS config, required fields)
- Trigger pattern templates (`onCreate`/`onUpdate` with `setUserId` — exact signatures)
- `emailOTP { data, error }` form pattern with error type discrimination
- `convex-test` test templates for auth trigger functions
- Common errors and root causes (CORS wildcard, missing secret, version mismatch)
- Session persistence debugging checklist

Skill location: `~/.claude/skills/convex-ba/SKILL.md`

---

## Implementation Order

All tests written first (red), then implementation (green).

1. **Write all three test files** — all tests must be failing before touching implementation
2. **Set `BETTER_AUTH_SECRET`** on Convex deployment (`npx convex env set`)
3. **`convex/schema.ts`** — add `authId: v.optional(v.string())` + `by_auth_id` index
4. **`convex/auth.ts`** — add `authFunctions`, `triggers.user.onCreate`, `triggers.user.onUpdate`, export `triggersApi()`
5. **`convex/http.ts`** — replace `"*"` with `process.env.SITE_URL` (throw if missing)
6. **`components/auth/email-otp-form.tsx`** — rewrite to `{ data, error }` pattern
7. **`npx convex dev`** — verify types regenerate without errors
8. **Run `vitest`** — all tests must pass
9. **`npx convex deploy`** — push to production

## Smoke Test Checklist (Manual)

After deploy, verify in order:

- [ ] Navigate to `/login` — email input renders, no console errors
- [ ] Enter a valid email → "Continue" — OTP email received within 60 seconds
- [ ] Enter correct 6-digit code → redirected to `/chat`
- [ ] Refresh `/chat` — still logged in (session cookie persists)
- [ ] Open Convex dashboard → `users` table → row exists with `authId` set and `plan: "trial"`
- [ ] Open browser DevTools → Application → Cookies → `better-auth.session_token` cookie present
- [ ] Sign out and sign back in — same `users` row (no duplicate created)
- [ ] Open Convex dashboard → verify `BETTER_AUTH_SECRET` is set on the deployment
