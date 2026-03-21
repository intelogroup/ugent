# Convex + Better Auth: Reliable OTP Auth & User Persistence

**Date:** 2026-03-21
**Project:** `~/Developer/ugent` (Next.js 15 + Convex + `@convex-dev/better-auth`)
**Status:** Approved — ready for implementation planning

---

## Problem Statement

The current email OTP auth flow has four distinct bugs causing login failures, session loss, and broken user data:

| # | Bug | Symptom |
|---|-----|---------|
| 1 | `CORS: "*"` with `credentials: true` | Browser rejects session cookie → user logged out on every refresh |
| 2 | `EmailOtpForm` uses `try/catch` instead of `{ data, error }` | Client throws even on success; hack fallback `getSession()` check added |
| 3 | No `triggers.user.onCreate` configured | Better Auth creates a user (UUID string) but the custom `users` table is never seeded → `jobs.userId` (Convex ID) breaks |
| 4 | `BETTER_AUTH_SECRET` not confirmed on Convex deployment | Sessions may be unsigned, invalidated on any redeploy |

---

## Approach: Targeted Fixes (Approach A)

Fix only the four root causes. No full rebuild. Minimal change surface. All changes are test-first (TDD).

**Why not Approach B (full `convexBetterAuthNextJs` migration)?**
The existing `http.ts` + `authComponent.registerRoutes` setup is functionally correct once CORS is fixed. A full migration would change 8+ files for no functional gain over targeted fixes.

**Why not Approach C (client-side upsert)?**
The `triggers.user.onCreate` API runs in the same transaction as user creation — atomically guaranteed. A client-side upsert can fail silently between the sign-in and upsert calls.

---

## Architecture

### Files Changed

```
convex/auth.ts                          ← add triggers.user.onCreate + setUserId
convex/http.ts                          ← fix CORS: replace "*" with SITE_URL
convex/schema.ts                        ← add authId field + by_auth_id index to users
components/auth/email-otp-form.tsx      ← rewrite to { data, error } pattern
```

### New Test Files

```
__tests__/auth-trigger.test.ts          ← convex-test: onCreate trigger
__tests__/auth-form.test.tsx            ← RTL: OTP form states
__tests__/auth-cors.test.ts             ← unit: CORS header correctness
```

---

## Data Model Changes

### `convex/schema.ts` — `users` table

Add `authId` field and index to allow the trigger to reference the Better Auth user:

```typescript
users: defineTable({
  email: v.optional(v.string()),
  authId: v.optional(v.string()),          // ← NEW: Better Auth user _id
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
  .index("by_auth_id", ["authId"])         // ← NEW
  .index("by_telegram_id", ["telegramId"])
  .index("by_whatsapp_phone", ["whatsappPhone"]),
```

**Migration note:** Existing rows will have `authId: undefined`. This is safe — they are pre-auth legacy rows. The index handles sparse values.

**threads.userId stays as `v.string()`** (Better Auth UUID) for now — Phase 2 migration.
**jobs.userId stays as `v.id("users")`** — works correctly after trigger is in place.

---

## Component Designs

### 1. `convex/auth.ts` — Triggers

Use the `@convex-dev/better-auth` `triggers` API. The `user.onCreate` callback runs **in the same Convex transaction** as user creation — atomic by design.

```typescript
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions: internal.auth,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        const userId = await ctx.db.insert("users", {
          email: authUser.email ?? undefined,
          authId: authUser._id,
          plan: "trial",
          trialStartedAt: Date.now(),
          createdAt: Date.now(),
        });
        await authComponent.setUserId(ctx, authUser._id, userId);
      },
      onUpdate: async (ctx, newAuthUser, prevAuthUser) => {
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

export const { onCreate, onUpdate } = authComponent.triggersApi();
```

**AuthFunctions reference:** `internal.auth` must be exported from `auth.ts` and referenced in `convex.config.ts`.

### 2. `convex/http.ts` — CORS Fix

Replace wildcard origin with specific `SITE_URL`. The wildcard `"*"` is incompatible with `credentials: true` — browsers silently drop the cookie.

```typescript
const origin = process.env.SITE_URL ?? "http://localhost:3000";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": origin,         // ← was "*"
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, better-auth.session_token",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};
```

### 3. `components/auth/email-otp-form.tsx` — Error Pattern

Replace the silent catch + fallback `getSession()` hack with the proper better-auth `{ data, error }` destructuring:

```typescript
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

Same pattern for `sendVerificationOtp`:
```typescript
const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
if (error) {
  setError("Could not send code. Please try again.");
  setLoading(false);
  return;
}
setStep("otp");
setLoading(false);
```

### 4. `BETTER_AUTH_SECRET` — Environment Variable

Must be set on the Convex deployment before any auth routes are live:

```bash
npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

This is a deploy-time prerequisite, not a code change. Document in README/CLAUDE.md.

---

## Test Plan (TDD)

Tests are written **before** implementation. Each test file maps to one unit.

### `__tests__/auth-trigger.test.ts` — `convex-test`

```
✓ onCreate: inserts a users row with plan "trial"
✓ onCreate: sets trialStartedAt to current time
✓ onCreate: authId on users row matches Better Auth user._id
✓ onCreate: setUserId links Convex ID back to Better Auth component
✓ onUpdate: syncs email when Better Auth email changes
✓ onUpdate: no-ops when email is unchanged
✓ getCurrentUser: returns null when no session
```

### `__tests__/auth-form.test.tsx` — React Testing Library

```
✓ renders email input on initial load
✓ shows loading state while sendVerificationOtp in flight
✓ advances to OTP step on sendVerificationOtp success
✓ shows error on sendVerificationOtp failure (error returned)
✓ shows loading state while signIn.emailOtp in flight
✓ calls onSuccess when signIn.emailOtp returns { data }
✓ shows error message when signIn.emailOtp returns { error }
✓ does not call onSuccess when error present
```

### `__tests__/auth-cors.test.ts` — unit

```
✓ CORS_HEADERS origin equals SITE_URL env var, not "*"
✓ CORS_HEADERS allows credentials
✓ OPTIONS preflight returns 204
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `sendVerificationOtp` fails (Resend down) | Show error "Could not send code" — do NOT advance to OTP step |
| `signIn.emailOtp` returns `{ error }` | Show `error.message` in the form, keep on OTP step |
| `signIn.emailOtp` returns `{ data }` | Call `onSuccess()` → router.push("/chat") |
| `onCreate` trigger fails (DB full, etc.) | Throws in-transaction → Better Auth user creation rolls back |
| `BETTER_AUTH_SECRET` missing | Sessions created but not signed → Convex rejects them silently |

---

## Security Considerations

- **CORS fix** prevents cookie theft via reflected credentials on wildcard origins
- **`BETTER_AUTH_SECRET`** must be rotated on compromise (all sessions invalidate)
- OTP codes expire in 600 seconds (10 min) — configured in `auth.ts`, acceptable for medical education use case
- `authId` is stored as a string in the `users` table — not a Convex document ID, so no `.get()` confusion
- No user PII beyond email is stored in the trigger's insert

---

## Out of Scope (Phase 2)

- Migrating `threads.userId` from string UUID to `v.id("users")`
- WhatsApp/Telegram user linking to the `users` table
- Stripe/plan management flows
- Magic link auth as an OTP fallback

---

## Convex-BA Skill

After implementation, a `convex-ba` Claude Code skill will be created capturing:
- Setup checklist (env vars, BETTER_AUTH_SECRET, CORS config)
- Trigger pattern templates (onCreate/onUpdate with setUserId)
- emailOTP `{ data, error }` form pattern
- `convex-test` test templates for auth functions
- Common errors and their root causes

Skill location: `~/.claude/skills/convex-ba/SKILL.md`

---

## Implementation Order

1. Write tests (all three test files, all failing)
2. `BETTER_AUTH_SECRET` → set on Convex deployment
3. `convex/schema.ts` → add `authId` + index
4. `convex/auth.ts` → add triggers + `authFunctions`
5. `convex/http.ts` → fix CORS origin
6. `components/auth/email-otp-form.tsx` → rewrite error handling
7. Run `npx convex dev` → verify types regenerate
8. Run tests → all pass
9. Deploy → `npx convex deploy`
10. Manual smoke test: sign in → session persists on refresh → `/chat` loads
