# WorkOS AuthKit Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken better-auth + cross-domain-localStorage setup with WorkOS AuthKit using server-side encrypted cookies — a first-class Convex-supported auth provider.

**Architecture:** WorkOS AuthKit handles the hosted login UI and OAuth flow. `authkitMiddleware()` manages encrypted session cookies. Convex validates WorkOS JWTs natively via `convex.json` provider config. API routes use `withAuth()` server-side to gate access.

**Tech Stack:** `@workos-inc/authkit-nextjs`, WorkOS Dashboard (Magic Auth / Email OTP), Convex native WorkOS provider, Next.js 15 server components.

---

## Files Changed

| Action | File | Purpose |
|--------|------|---------|
| Modify | `package.json` | Add workos, remove better-auth packages |
| Modify | `convex.json` | Add WorkOS auth provider |
| Delete | `convex/auth.config.ts` | Replaced by convex.json provider block |
| Rewrite | `convex/auth.ts` | Remove authComponent/triggers, keep simple getCurrentUser |
| Modify | `convex/schema.ts` | Replace `authId` → `tokenIdentifier`, add `storeUser` mutation |
| Delete | `app/api/auth/[...all]/route.ts` | WorkOS uses its own callback route |
| Create | `app/callback/route.ts` | WorkOS OAuth callback handler |
| Rewrite | `middleware.ts` | `authkitMiddleware()` replaces manual middleware |
| Rewrite | `lib/auth-server.ts` | WorkOS `withAuth()` helper re-export |
| Delete | `lib/auth-client.ts` | No longer needed (cookies, not localStorage) |
| Modify | `app/layout.tsx` | `AuthKitProvider` + plain `ConvexProvider` |
| Modify | `app/(app)/layout.tsx` | `withAuth()` replaces `useConvexAuth()` |
| Rewrite | `app/login/page.tsx` | WorkOS `getSignInUrl()` link replaces EmailOtpForm |
| Delete | `components/auth/email-otp-form.tsx` | Replaced by WorkOS hosted UI |
| Modify | `app/api/chat/route.ts` | `withAuth()` replaces `isAuthenticated()` |
| Modify | `app/api/facts/route.ts` | `withAuth()` replaces `isAuthenticated()` |
| Modify | `app/api/notifications/subscribe/route.ts` | `withAuth()` replaces `fetchAuthMutation` |
| Modify | `convex/pushSubscriptions.ts` | Accept `userId: v.id("users")` param instead of auth context |
| Modify | `convex/threads.ts` + `bookmarks.ts` + `reviewCards.ts` + `confidenceRatings.ts` + `botOnboarding.ts` | Audit `userId: v.string()` fields — ensure they store Convex `_id`, not better-auth UUIDs |
| Rewrite | `__tests__/auth-trigger.test.ts` | Replace better-auth trigger tests with `storeUser`/`getCurrentUser` tests |
| Modify | `__tests__/chat-route-auth.test.ts` + `chat-validation.test.ts` | Replace `isAuthenticated` mocks with `withAuth` mocks |
| Modify | `__tests__/notifications-subscribe.test.ts` + `notifications-subscribe-auth.test.ts` | Replace `fetchAuthMutation` mocks with `withAuth` + `fetchMutation` mocks |

---

## Task 1: Install WorkOS, Remove Better-Auth

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install WorkOS package**

```bash
npm install @workos-inc/authkit-nextjs
```

- [ ] **Step 2: Remove better-auth packages**

```bash
npm uninstall better-auth @convex-dev/better-auth
```

- [ ] **Step 3: Verify installs**

```bash
npm ls @workos-inc/authkit-nextjs
```
Expected: version printed, no errors.

- [ ] **Step 4: Add env vars to `.env.local`**

Add these (get values from WorkOS Dashboard → API Keys and your Convex dashboard):

```bash
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
WORKOS_REDIRECT_URI=http://localhost:3000/callback
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback
WORKOS_COOKIE_PASSWORD=<32+ random chars — use: openssl rand -base64 32>
```

> **Note:** `WORKOS_REDIRECT_URI` must also be registered in WorkOS Dashboard → Redirects.
> Enable "Magic Auth" (Email OTP) in WorkOS Dashboard → Authentication → Sign-in methods.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap better-auth for workos authkit"
```

---

## Task 2: Configure Convex WorkOS Provider

**Files:**
- Modify: `convex.json`
- Delete: `convex/auth.config.ts`

- [ ] **Step 1: Update `convex.json`**

Open `convex.json` and replace or add the `auth` block:

```json
{
  "functions": "convex/",
  "auth": {
    "providers": [
      {
        "type": "workos",
        "clientId": "<your WORKOS_CLIENT_ID value>"
      }
    ]
  }
}
```

> **Note:** If `npx convex dev` rejects `"type": "workos"` (it's a named provider Convex added in recent versions), fall back to the OIDC form:
> ```json
> { "domain": "https://api.workos.com/user_management/jwks/<YOUR_CLIENT_ID>" }
> ```
> The `"type": "workos"` form is confirmed working as of Convex SDK 1.34+ — try it first.

- [ ] **Step 2: Delete old Convex auth config**

```bash
rm convex/auth.config.ts
```

- [ ] **Step 3: Deploy Convex to pick up new provider**

```bash
npx convex dev
```

Expected: no TypeScript errors, Convex syncs successfully.

- [ ] **Step 4: Commit**

```bash
git add convex.json
git commit -m "feat: configure convex workos auth provider"
```

---

## Task 3: Rewrite `convex/auth.ts` and Update Schema

**Files:**
- Rewrite: `convex/auth.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Write failing tests for `getCurrentUser` and `storeUser`**

Find the existing auth trigger tests:

```bash
find . -name "auth-trigger*" -o -name "*.test.ts" | xargs grep -l "authComponent\|better-auth\|onCreate\|onUpdate" 2>/dev/null
```

Replace the entire `__tests__/auth-trigger.test.ts` file with:

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

test("getCurrentUser returns null when unauthenticated", async () => {
  const t = convexTest(schema);
  const result = await t.query(api.auth.getCurrentUser, {});
  expect(result).toBeNull();
});

test("storeUser throws when unauthenticated", async () => {
  const t = convexTest(schema);
  await expect(
    t.mutation(api.auth.storeUser, { email: "test@example.com" })
  ).rejects.toThrow("Not authenticated");
});

test("storeUser creates user on first call", async () => {
  const t = convexTest(schema);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_123", email: "test@example.com" });
  const userId = await asUser.mutation(api.auth.storeUser, {
    name: "Test User",
    email: "test@example.com",
  });
  expect(userId).toBeTruthy();
});

test("storeUser is idempotent — second call updates, not inserts", async () => {
  const t = convexTest(schema);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_123", email: "test@example.com" });
  const id1 = await asUser.mutation(api.auth.storeUser, { name: "First" });
  const id2 = await asUser.mutation(api.auth.storeUser, { name: "Updated" });
  expect(id1).toEqual(id2); // same record, not a new one
});

test("getCurrentUser returns user after storeUser", async () => {
  const t = convexTest(schema);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_456", email: "user@example.com" });
  await asUser.mutation(api.auth.storeUser, { email: "user@example.com" });
  const user = await asUser.query(api.auth.getCurrentUser, {});
  expect(user?.email).toBe("user@example.com");
});
```

- [ ] **Step 1b: Run these tests and confirm they fail (stubs not yet written)**

```bash
npm test -- auth-trigger
```

Expected: FAIL — `api.auth.storeUser` does not exist yet.

- [ ] **Step 2: Rewrite `convex/auth.ts`**

Replace the entire file:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Returns current user from users table, or null if not logged in
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});

// Create or update user record on first login
export const storeUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        email: args.email ?? existing.email,
        image: args.image ?? existing.image,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: args.name,
      email: args.email,
      image: args.image,
      plan: "trial",
      trialStartedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Update `convex/schema.ts` users table**

Find the `users` table definition. Replace `authId` with `tokenIdentifier`:

```typescript
users: defineTable({
  tokenIdentifier: v.string(),          // WorkOS identity — primary auth key
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  plan: v.optional(v.string()),         // "trial" | "active"
  trialStartedAt: v.optional(v.number()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  telegramId: v.optional(v.string()),
  whatsappPhone: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  stripePriceId: v.optional(v.string()),
  stripeCurrentPeriodEnd: v.optional(v.number()),
  subscriptionStatus: v.optional(v.string()),
  planExpiresAt: v.optional(v.number()),
})
  .index("by_token", ["tokenIdentifier"])   // primary auth lookup
  .index("by_email", ["email"])
  .index("by_stripe_customer", ["stripeCustomerId"]),
```

> **Note:** Remove `.index("by_auth_id", ["authId"])` and the `authId` field.

- [ ] **Step 4: Run `npx convex dev` to verify schema compiles**

Expected: Convex schema validation passes, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add convex/auth.ts convex/schema.ts
git commit -m "feat: rewrite convex auth with workos tokenIdentifier"
```

---

## Task 4: Rewrite Middleware + Add Callback Route

**Files:**
- Rewrite: `middleware.ts`
- Create: `app/callback/route.ts`
- Delete: `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Rewrite `middleware.ts`**

Replace entire file:

```typescript
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware();

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Create `app/callback/route.ts`**

```typescript
import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth({ returnPathname: '/dashboard' });
```

- [ ] **Step 3: Delete old auth catch-all route**

```bash
rm app/api/auth/\[...all\]/route.ts
# or: rm -rf app/api/auth
```

- [ ] **Step 4: Start dev server and verify no middleware errors**

```bash
npm run dev
```

Expected: server starts, no `You must provide a redirect URI` error.
If you see that error: check `.env.local` has `WORKOS_REDIRECT_URI` (not just `NEXT_PUBLIC_WORKOS_REDIRECT_URI`).

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/callback/route.ts
git commit -m "feat: workos middleware + callback route"
```

---

## Task 5: Update Layout Providers

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/ConvexClientProvider.tsx` (create if doesn't exist)

- [ ] **Step 1: Create `components/ConvexClientProvider.tsx`**

```typescript
'use client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

- [ ] **Step 2: Update `app/layout.tsx` provider wrapping**

Replace whatever auth provider imports exist. The body should wrap with:

```typescript
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';
import { ConvexClientProvider } from '@/components/ConvexClientProvider';

// In the JSX:
<AuthKitProvider>
  <ConvexClientProvider>
    {children}
  </ConvexClientProvider>
</AuthKitProvider>
```

Remove any imports from `lib/auth-client`, `@convex-dev/better-auth`, or `ConvexProviderWithBetterAuth`.

- [ ] **Step 3: Run `npm run dev`, open browser, check no console errors on root page**

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/ConvexClientProvider.tsx
git commit -m "feat: workos authkit + convex providers in layout"
```

---

## Task 6: Rewrite Login Page

**Files:**
- Rewrite: `app/login/page.tsx`
- Delete: `components/auth/email-otp-form.tsx`

- [ ] **Step 1: Rewrite `app/login/page.tsx`**

```typescript
import { getSignInUrl, withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const { user } = await withAuth();
  if (user) redirect('/dashboard');

  const signInUrl = await getSignInUrl();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">Sign in to UGent</h1>
        <a
          href={signInUrl}
          className="rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Continue with Email
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the old OTP form component**

```bash
rm components/auth/email-otp-form.tsx
```

- [ ] **Step 3: Check for any remaining imports of `email-otp-form`**

```bash
grep -r "email-otp-form" .
```

Expected: no results.

- [ ] **Step 4: Visit `http://localhost:3000/login` in browser**

Expected: page renders with "Continue with Email" link pointing to WorkOS hosted UI.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: workos hosted login page"
```

---

## Task 7: Rewrite `lib/auth-server.ts`, Delete `lib/auth-client.ts`

**Files:**
- Rewrite: `lib/auth-server.ts`
- Delete: `lib/auth-client.ts`

- [ ] **Step 1: Rewrite `lib/auth-server.ts`**

```typescript
import { withAuth, getAuth } from '@workos-inc/authkit-nextjs';

export { withAuth, getAuth };

// Helper: get authenticated user or throw 401-compatible object
export async function requireAuth() {
  const { user } = await withAuth();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return user;
}
```

- [ ] **Step 2: Delete auth-client**

```bash
rm lib/auth-client.ts
```

- [ ] **Step 3: Check for remaining `auth-client` imports**

```bash
grep -r "auth-client" . --include="*.ts" --include="*.tsx"
```

Expected: no results. Fix any that remain.

- [ ] **Step 4: Commit**

```bash
git add lib/auth-server.ts
git commit -m "feat: workos auth-server helper, remove auth-client"
```

---

## Task 8: Update Protected App Layout

**Files:**
- Modify: `app/(app)/layout.tsx`

The current layout uses `useConvexAuth()` client-side. Switch to server-side `withAuth()`.

- [ ] **Step 1: Remove `"use client"` directive from `app/(app)/layout.tsx`**

The file currently starts with `"use client"`. Delete that line — this becomes a Server Component.

- [ ] **Step 2: Rewrite `app/(app)/layout.tsx`**

```typescript
// NO "use client" — this is a Server Component
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = await withAuth();
  if (!user) redirect('/login');

  // Sync user into Convex DB on every protected page load (idempotent)
  // accessToken is the WorkOS JWT — required for ctx.auth.getUserIdentity() inside Convex
  await fetchMutation(
    api.auth.storeUser,
    { name: user.firstName ?? undefined, email: user.email ?? undefined, image: user.profilePictureUrl ?? undefined },
    { token: accessToken }
  );

  return <>{children}</>;
}
```

> **Why pass `{ token: accessToken }`:** Convex server mutations need the WorkOS JWT to resolve `ctx.auth.getUserIdentity()`. Without it, `tokenIdentifier` is null and `storeUser` throws. The `accessToken` from `withAuth()` is the WorkOS short-lived JWT — pass it directly to `fetchMutation`.

- [ ] **Step 3: Check if any child components in `app/(app)/` used `useConvexAuth()` and update them**

```bash
grep -r "useConvexAuth" app/
```

For any results: replace with `useAuth()` from `@workos-inc/authkit-nextjs/components` or use `withAuth()` in the nearest server component ancestor.

- [ ] **Step 4: Navigate to a protected page while logged out — verify redirect to `/login`**

- [ ] **Step 5: Log in and verify user appears in Convex dashboard → Data → users table**

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/layout.tsx"
git commit -m "feat: server-side auth gate + storeUser sync on login"
```

---

## Task 9: Update API Routes

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/facts/route.ts`
- Modify: `app/api/notifications/subscribe/route.ts`

### 9a — Chat Route

- [ ] **Step 1: Find the auth check in `app/api/chat/route.ts`**

```bash
grep -n "isAuthenticated\|fetchAuth\|auth" app/api/chat/route.ts
```

- [ ] **Step 2: Replace `isAuthenticated()` with WorkOS `withAuth()`**

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

// At the top of your handler:
const { user } = await withAuth();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Remove import of `isAuthenticated` from `lib/auth-server`.

### 9b — Facts Route

- [ ] **Step 3: Same pattern in `app/api/facts/route.ts`**

Replace `isAuthenticated()` with:

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';
const { user } = await withAuth();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### 9c — Push Subscription Route

- [ ] **Step 4: Rewrite auth in `app/api/notifications/subscribe/route.ts`**

The current route uses `fetchAuthMutation` which passes the better-auth session to Convex.
With WorkOS, get the user server-side, then call Convex mutation directly:

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function POST(req: Request) {
  const { user } = await withAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { endpoint, keys } = body;

  try {
    // Look up Convex user by WorkOS email
    const convexUser = await fetchQuery(api.users.getByEmail, { email: user.email });
    if (!convexUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await fetchMutation(api.pushSubscriptions.subscribe, {
      userId: convexUser._id,
      endpoint,
      keys,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user } = await withAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { endpoint } = body;

  try {
    const convexUser = await fetchQuery(api.users.getByEmail, { email: user.email });
    if (!convexUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await fetchMutation(api.pushSubscriptions.unsubscribe, {
      userId: convexUser._id,
      endpoint,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
```

> **Note:** You'll also need to add a `getByEmail` query to `convex/users.ts`:
> ```typescript
> export const getByEmail = query({
>   args: { email: v.string() },
>   handler: async (ctx, { email }) =>
>     ctx.db.query("users").withIndex("by_email", q => q.eq("email", email)).unique(),
> });
> ```
> And update `convex/pushSubscriptions.ts` to accept `userId` param instead of reading from auth context.

- [ ] **Step 5: Run `npm test` — check how many tests pass**

```bash
npm test
```

Record failures. Auth-related test failures are expected at this stage.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.ts app/api/facts/route.ts app/api/notifications/subscribe/route.ts convex/auth.ts
git commit -m "feat: update api routes to workos withAuth pattern"
```

---

## Task 10: Update `convex/pushSubscriptions.ts` Signature

**Files:**
- Modify: `convex/pushSubscriptions.ts`
- Modify: `convex/auth.ts` (add `getByEmail` query)

The current `subscribe`/`unsubscribe` mutations resolve the user from the better-auth session context. They must be updated to accept an explicit `userId` param.

- [ ] **Step 1: Read the current `pushSubscriptions.ts`**

```bash
grep -n "auth\|userId\|getUserIdentity" convex/pushSubscriptions.ts
```

- [ ] **Step 2: Update `subscribe` and `unsubscribe` to accept `userId: v.id("users")`**

Change the args from resolving identity internally to accepting it as a param:

```typescript
export const subscribe = mutation({
  args: {
    userId: v.id("users"),   // caller (API route) passes this
    endpoint: v.string(),
    keys: v.object({ p256dh: v.string(), auth: v.string() }),
  },
  handler: async (ctx, args) => {
    // Remove any ctx.auth.getUserIdentity() calls — userId is explicit
    await ctx.db.insert("pushSubscriptions", {
      userId: args.userId,
      endpoint: args.endpoint,
      keys: args.keys,
    });
  },
});

export const unsubscribe = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("endpoint"), args.endpoint))
      .unique();
    if (sub) await ctx.db.delete(sub._id);
  },
});
```

- [ ] **Step 3: Add `getByEmail` query to `convex/auth.ts`**

Append to `convex/auth.ts`:

```typescript
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) =>
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique(),
});
```

- [ ] **Step 4: Run `npx convex dev` — verify no TypeScript errors**

- [ ] **Step 5: Commit**

```bash
git add convex/pushSubscriptions.ts convex/auth.ts
git commit -m "feat: pushSubscriptions accepts explicit userId param"
```

---

## Task 11: Audit `userId` String Fields Across Schema

**Files:**
- Modify: `convex/schema.ts` (verify field types)
- Audit: `convex/threads.ts`, `convex/bookmarks.ts`, `convex/reviewCards.ts`, `convex/confidenceRatings.ts`, `convex/botOnboarding.ts`

The better-auth setup stored UUID strings as `userId`. Now `userId` should be `v.id("users")` (Convex document ID) or `v.string()` holding `tokenIdentifier`. This task audits and resolves the inconsistency.

- [ ] **Step 1: Find all `userId` usages in Convex functions**

```bash
grep -rn "userId" convex/ --include="*.ts" | grep -v "_generated"
```

- [ ] **Step 2: For each file, determine what `userId` currently stores**

Check if the value is:
- A better-auth UUID → needs migration to `tokenIdentifier` or Convex `_id`
- Already a Convex `_id` → change type to `v.id("users")`

- [ ] **Step 3: Update schema table definitions to use `v.id("users")` for userId fields**

Prefer `v.id("users")` over `v.string()` for FK references — Convex enforces referential integrity.

Example (update each affected table in `schema.ts`):
```typescript
// Before:
userId: v.string(),  // Better Auth user ID (string UUID)
// After:
userId: v.id("users"),  // Convex user document ID
```

- [ ] **Step 4: Update all queries/mutations that write `userId` to pass the Convex `_id`**

In API routes, after looking up the user via `getByEmail`, use `convexUser._id` as the `userId`:

```typescript
const convexUser = await fetchQuery(api.auth.getByEmail, { email: user.email });
// pass convexUser._id wherever userId is needed
```

- [ ] **Step 5: Run `npx convex dev` — verify schema + function TypeScript compiles**

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/threads.ts convex/bookmarks.ts convex/reviewCards.ts convex/confidenceRatings.ts convex/botOnboarding.ts
git commit -m "fix: userId fields use v.id(users) for type safety"
```

---

## Task 12: Rewrite Auth-Related Tests

**Files:**
- Rewrite: `__tests__/auth-trigger.test.ts`
- Modify: `__tests__/chat-route-auth.test.ts`
- Modify: `__tests__/chat-validation.test.ts`
- Modify: `__tests__/notifications-subscribe.test.ts`
- Modify: `__tests__/notifications-subscribe-auth.test.ts`

### 12a — Chat route auth tests

- [ ] **Step 1: Find the `isAuthenticated` mock in chat tests**

```bash
grep -n "isAuthenticated\|auth-server\|fetchAuth" __tests__/chat-route-auth.test.ts __tests__/chat-validation.test.ts
```

- [ ] **Step 2: Replace `isAuthenticated` mock with `withAuth` mock**

```typescript
// Before:
vi.mock('@/lib/auth-server', () => ({ isAuthenticated: vi.fn() }));
// ...
vi.mocked(isAuthenticated).mockResolvedValue(true);

// After:
vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(),
}));
import { withAuth } from '@workos-inc/authkit-nextjs';
// ...
vi.mocked(withAuth).mockResolvedValue({ user: { email: 'test@example.com', firstName: 'Test' }, accessToken: 'mock-token' } as any);

// For unauthenticated test:
vi.mocked(withAuth).mockResolvedValue({ user: null, accessToken: null } as any);
```

- [ ] **Step 3: Run chat tests**

```bash
npm test -- chat-route-auth chat-validation
```

Expected: PASS.

### 12b — Notification subscribe tests

- [ ] **Step 4: Find the `fetchAuthMutation` mock in notification tests**

```bash
grep -n "fetchAuthMutation\|fetchAuth\|auth-server" __tests__/notifications-subscribe*.test.ts
```

- [ ] **Step 5: Replace with `withAuth` + `fetchMutation` mocks**

```typescript
// Before:
vi.mock('@/lib/auth-server', () => ({ fetchAuthMutation: vi.fn() }));

// After:
vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn().mockResolvedValue({ user: { email: 'test@example.com' }, accessToken: 'tok' }),
}));
vi.mock('convex/nextjs', () => ({
  fetchMutation: vi.fn().mockResolvedValue(undefined),
  fetchQuery: vi.fn().mockResolvedValue({ _id: 'users:abc123', email: 'test@example.com' }),
}));
```

- [ ] **Step 6: Run notification tests**

```bash
npm test -- notifications-subscribe
```

Expected: PASS.

- [ ] **Step 7: Run full suite**

```bash
npm test
```

Expected: all 37 tests pass.

- [ ] **Step 8: Commit**

```bash
git add __tests__/
git commit -m "test: update all auth test mocks for workos withAuth pattern"
```

---

## Task 13: Update Auth Error Boundary

**Files:**
- Modify: `components/auth/auth-error-boundary.tsx`

- [ ] **Step 1: Check what error patterns the boundary catches**

```bash
grep -n "Unauthenticated\|Unauthorized\|401\|workos" components/auth/auth-error-boundary.tsx
```

- [ ] **Step 2: Update error detection if needed**

WorkOS session expiry throws differently than better-auth. Update the catch:

```typescript
// Replace better-auth specific error checks with:
const isAuthError =
  error?.status === 401 ||
  error?.message?.includes('Unauthorized') ||
  error?.message?.includes('session');
```

- [ ] **Step 3: Commit**

```bash
git add components/auth/auth-error-boundary.tsx
git commit -m "fix: update auth error boundary for workos session errors"
```

---

## Task 14: Final Cleanup + Smoke Test

**Files:**
- Various cleanup

- [ ] **Step 1: Search for any remaining better-auth imports**

```bash
grep -r "better-auth\|@convex-dev/better-auth\|authClient\|emailOtp\|crossDomain" . \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=".next"
```

Expected: no results. Fix any that remain.

- [ ] **Step 2: Search for remaining `fetchAuthMutation`/`fetchAuthQuery`/`isAuthenticated` usages**

```bash
grep -r "fetchAuthMutation\|fetchAuthQuery\|fetchAuthAction\|isAuthenticated" . \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules
```

Expected: no results.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all 37 tests pass. Fix failures before proceeding.

- [ ] **Step 4: Manual smoke test — full auth flow**

1. Open `http://localhost:3000/login`
2. Click "Continue with Email" → WorkOS hosted UI
3. Enter your email → receive OTP
4. Enter OTP → redirected to `/dashboard`
5. Reload `/dashboard` → stays logged in (cookie persists)
6. Open `/api/chat` directly → returns 401 (not logged in via API)
7. Open devtools → no `localStorage` auth keys (using cookies now)

- [ ] **Step 5: Deploy Convex**

```bash
npx convex deploy
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: complete workos auth migration, all tests passing"
```

---

## Env Vars Checklist (Vercel)

After local testing, add to Vercel dashboard for production:

- [ ] `WORKOS_API_KEY`
- [ ] `WORKOS_CLIENT_ID`
- [ ] `WORKOS_REDIRECT_URI=https://your-app.vercel.app/callback`
- [ ] `NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://your-app.vercel.app/callback`
- [ ] `WORKOS_COOKIE_PASSWORD` (32+ chars)
- [ ] Register `https://your-app.vercel.app/callback` in WorkOS Dashboard → Redirects

---

## Common Errors Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `You must provide a redirect URI` | `WORKOS_REDIRECT_URI` missing from `.env.local` | Add it — `vercel env pull` only pulls `NEXT_PUBLIC_` version |
| `withAuth()` returns null user | Not logged in or cookie expired | Redirect to `/login` — normal behavior |
| `useAuth()` returns null | `AuthKitProvider` missing | Wrap app in `<AuthKitProvider>` in `app/layout.tsx` |
| Convex `getUserIdentity()` null | `convex.json` provider mismatch | Verify `clientId` matches `WORKOS_CLIENT_ID` |
| 37 tests → fewer pass | Tests mock better-auth specific modules | Update mocks to WorkOS patterns |
