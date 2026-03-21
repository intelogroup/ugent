# Convex Better Auth OTP Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four root-cause bugs in the Convex + Better Auth OTP flow: wildcard CORS blocking session cookies, silent-catch error handling in the OTP form, missing `triggers.user.onCreate` that leaves the custom `users` table unseeded, and unset `BETTER_AUTH_SECRET`.

**Architecture:** Test-first (all tests written failing before any implementation). Triggers run atomically in the same Convex transaction as user creation — `setUserId` links the Better Auth UUID to the Convex `v.id("users")`. CORS is fixed by requiring `SITE_URL` (hard fail if missing). The OTP form uses the `{ data, error }` destructuring pattern throughout.

**Tech Stack:** Next.js 15, Convex v1.34, `@convex-dev/better-auth` v0.11.3, `better-auth` v1.5.5, `convex-test` v0.0.41, `vitest` v4, `@testing-library/react` v16, Resend

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `__tests__/auth-trigger.test.ts` | **Create** | convex-test unit tests for onCreate/onUpdate triggers |
| `__tests__/auth-form.test.tsx` | **Create** | RTL tests for OTP form state machine |
| `__tests__/auth-cors.test.ts` | **Create** | Unit tests for CORS header helper |
| `convex/lib/cors.ts` | **Create** | Extracted CORS header helper (inside convex/ for Convex bundler access) |
| `convex/schema.ts` | **Modify** | Add `authId: v.optional(v.string())` + `by_auth_id` index to users |
| `convex/auth.ts` | **Modify** | Add `authFunctions`, `triggers.user.onCreate/onUpdate`, export `triggersApi()` |
| `convex/http.ts` | **Modify** | Replace `"*"` origin with `getCorsHeaders()` from `convex/lib/cors.ts` |
| `components/auth/email-otp-form.tsx` | **Modify** | Rewrite to `{ data, error }` pattern; remove all catch hacks |

---

## Task 1: Bootstrap test infrastructure

**Files:**
- Check: `vitest.config.ts` (or `package.json` vitest config)
- Check: `__tests__/setup.ts`

- [ ] **Step 1: Verify vitest config supports convex-test**

```bash
cd ~/Developer/ugent && cat vitest.config.ts 2>/dev/null || cat vite.config.ts 2>/dev/null || echo "check package.json"
cat __tests__/setup.ts
```

Expected: vitest configured with jsdom environment and convex-test setup. If convex-test is not imported in setup.ts, add it.

- [ ] **Step 2: Confirm test runner works**

```bash
cd ~/Developer/ugent && npx vitest run --reporter=verbose 2>&1 | head -30
```

Expected: existing tests run (pass or fail — just confirm runner works). If it errors on config, fix config before continuing.

- [ ] **Step 3: Commit if any config changes made**

```bash
git add vitest.config.ts vite.config.ts __tests__/setup.ts
git commit -m "chore: verify vitest + convex-test config"
```

---

## Task 2: Write failing CORS tests

**Files:**
- Create: `__tests__/auth-cors.test.ts`
- Create: `lib/cors.ts` (stub — will be implemented in Task 5)

- [ ] **Step 1: Create `convex/lib/cors.ts` stub**

`lib/cors.ts` must live inside `convex/` because Convex bundles its functions separately — `convex/http.ts` cannot import from project-root `lib/`.

```typescript
// convex/lib/cors.ts
export function getCorsHeaders(): Record<string, string> {
  throw new Error("not implemented");
}
```

- [ ] **Step 2: Write `__tests__/auth-cors.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the getCorsHeaders helper in isolation
// The function reads process.env.SITE_URL at call time

describe("getCorsHeaders", () => {
  const originalSiteUrl = process.env.SITE_URL;

  afterEach(() => {
    // Restore env after each test
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrl;
    }
    vi.resetModules();
  });

  it("returns origin equal to SITE_URL env var", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://ugent2.vercel.app");
  });

  it("allows credentials", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("throws if SITE_URL is not set", async () => {
    delete process.env.SITE_URL;
    const { getCorsHeaders } = await import("../convex/lib/cors");
    expect(() => getCorsHeaders()).toThrowError("SITE_URL env var is required");
  });

  it("does not use wildcard origin", async () => {
    process.env.SITE_URL = "https://ugent2.vercel.app";
    const { getCorsHeaders } = await import("../convex/lib/cors");
    const headers = getCorsHeaders();
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });
});
```

- [ ] **Step 3: Run and confirm tests fail**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-cors.test.ts --reporter=verbose
```

Expected: 4 tests fail (stub throws "not implemented").

- [ ] **Step 4: Commit failing tests**

```bash
git add __tests__/auth-cors.test.ts lib/cors.ts
git commit -m "test: add failing CORS header tests"
```

---

## Task 3: Write failing OTP form tests

**Files:**
- Create: `__tests__/auth-form.test.tsx`

- [ ] **Step 1: Write `__tests__/auth-form.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailOtpForm } from "../components/auth/email-otp-form";

// Mock the auth client
vi.mock("../lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: vi.fn(),
    },
    signIn: {
      emailOtp: vi.fn(),
    },
  },
}));

import { authClient } from "../lib/auth-client";

const mockSendOtp = authClient.emailOtp.sendVerificationOtp as ReturnType<typeof vi.fn>;
const mockSignIn = authClient.signIn.emailOtp as ReturnType<typeof vi.fn>;

describe("EmailOtpForm", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email input on initial load", () => {
    render(<EmailOtpForm onSuccess={onSuccess} />);
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/6-digit code/i)).not.toBeInTheDocument();
  });

  it("shows loading state while sendVerificationOtp is in flight", async () => {
    mockSendOtp.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });
  });

  it("advances to OTP step when sendVerificationOtp resolves with no error", async () => {
    mockSendOtp.mockResolvedValue({ data: {}, error: null });
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/6-digit code/i)).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText(/email address/i)).not.toBeInTheDocument();
  });

  it("stays on email step and shows error when sendVerificationOtp returns error", async () => {
    mockSendOtp.mockResolvedValue({ data: null, error: { message: "Resend failed" } });
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText(/could not send code/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
  });

  it("shows loading state while signIn.emailOtp is in flight", async () => {
    mockSendOtp.mockResolvedValue({ data: {}, error: null });
    mockSignIn.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<EmailOtpForm onSuccess={onSuccess} />);
    // Advance to OTP step
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => screen.getByPlaceholderText(/6-digit code/i));
    // Submit OTP
    await userEvent.type(screen.getByPlaceholderText(/6-digit code/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /verifying/i })).toBeDisabled();
    });
  });

  it("calls onSuccess when signIn.emailOtp returns { data }", async () => {
    mockSendOtp.mockResolvedValue({ data: {}, error: null });
    mockSignIn.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => screen.getByPlaceholderText(/6-digit code/i));
    await userEvent.type(screen.getByPlaceholderText(/6-digit code/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("shows error and does not call onSuccess when signIn.emailOtp returns { error }", async () => {
    mockSendOtp.mockResolvedValue({ data: {}, error: null });
    mockSignIn.mockResolvedValue({ data: null, error: { message: "Invalid code", status: 400 } });
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => screen.getByPlaceholderText(/6-digit code/i));
    await userEvent.type(screen.getByPlaceholderText(/6-digit code/i), "000000");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows rate limit message on 429 error", async () => {
    mockSendOtp.mockResolvedValue({ data: {}, error: null });
    mockSignIn.mockResolvedValue({ data: null, error: { message: "Too many requests", status: 429 } });
    render(<EmailOtpForm onSuccess={onSuccess} />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: /continue/i }).closest("form")!);
    await waitFor(() => screen.getByPlaceholderText(/6-digit code/i));
    await userEvent.type(screen.getByPlaceholderText(/6-digit code/i), "123456");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Check if `@testing-library/user-event` is installed**

```bash
cd ~/Developer/ugent && cat package.json | grep user-event
```

If missing: `npm install -D @testing-library/user-event`

- [ ] **Step 3: Run and confirm tests fail**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-form.test.tsx --reporter=verbose
```

Expected: 8 tests fail (component has wrong behavior / missing `{ data, error }` pattern).

- [ ] **Step 4: Commit failing tests**

```bash
git add __tests__/auth-form.test.tsx
git commit -m "test: add failing OTP form tests"
```

---

## Task 4: Write failing trigger tests

**Files:**
- Create: `__tests__/auth-trigger.test.ts`

Note: `convex-test` runs the actual Convex schema and functions in a mock environment. You need the schema to be updated (Task 6) before these tests fully work — but write them now so they fail correctly.

- [ ] **Step 1: Check convex-test setup in existing tests**

```bash
cd ~/Developer/ugent && cat __tests__/setup.ts && head -20 __tests__/facts-agent.test.ts
```

Note the import pattern for `convex-test` — copy it exactly.

- [ ] **Step 2: Write `__tests__/auth-trigger.test.ts`**

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, vi } from "vitest";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";

// convex-test mocks the full Convex backend in memory
// It runs the actual schema validators and mutation logic

describe("auth triggers", () => {
  it("onCreate inserts a users row with plan trial", async () => {
    const t = convexTest(schema);

    // Simulate Better Auth firing onCreate for a new user
    await t.mutation(internal.auth.onCreate, {
      doc: {
        _id: "auth_abc123" as any,
        email: "test@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const users = await t.query(internal.users.listAll, {});
    expect(users).toHaveLength(1);
    expect(users[0].plan).toBe("trial");
  });

  it("onCreate sets authId to the Better Auth user _id", async () => {
    const t = convexTest(schema);

    await t.mutation(internal.auth.onCreate, {
      doc: {
        _id: "auth_abc123" as any,
        email: "test@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const users = await t.query(internal.users.listAll, {});
    expect(users[0].authId).toBe("auth_abc123");
  });

  it("onCreate sets trialStartedAt to approximately now", async () => {
    const t = convexTest(schema);
    const before = Date.now();

    await t.mutation(internal.auth.onCreate, {
      doc: {
        _id: "auth_xyz789" as any,
        email: "another@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const after = Date.now();
    const users = await t.query(internal.users.listAll, {});
    expect(users[0].trialStartedAt).toBeGreaterThanOrEqual(before);
    expect(users[0].trialStartedAt).toBeLessThanOrEqual(after + 100);
  });

  it("onUpdate syncs email when Better Auth email changes", async () => {
    const t = convexTest(schema);

    // First create the user
    await t.mutation(internal.auth.onCreate, {
      doc: {
        _id: "auth_abc123" as any,
        email: "old@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    // Now update email
    await t.mutation(internal.auth.onUpdate, {
      newDoc: {
        _id: "auth_abc123" as any,
        email: "new@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      oldDoc: {
        _id: "auth_abc123" as any,
        email: "old@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const users = await t.query(internal.users.listAll, {});
    expect(users[0].email).toBe("new@example.com");
  });

  it("onUpdate does not change email when it is unchanged", async () => {
    const t = convexTest(schema);

    await t.mutation(internal.auth.onCreate, {
      doc: {
        _id: "auth_abc123" as any,
        email: "same@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    // Update with same email — state assertion only (convex-test ctx.db is not spyable)
    await t.mutation(internal.auth.onUpdate, {
      newDoc: {
        _id: "auth_abc123" as any,
        email: "same@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      oldDoc: {
        _id: "auth_abc123" as any,
        email: "same@example.com",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    // Assert final state is unchanged
    const users = await t.query(internal.users.listAll, {});
    expect(users[0].email).toBe("same@example.com");
  });

  it("getCurrentUser returns null when no auth context", async () => {
    const t = convexTest(schema);
    const user = await t.query(api.auth.getCurrentUser, {});
    expect(user).toBeNull();
  });
});
```

- [ ] **Step 3: Add an `internalQuery` to `convex/users.ts` for test access**

Must use `internalQuery` (not `query`) — this is test-only access and must never be exposed as a public API endpoint.

```typescript
// convex/users.ts — add this (use internalQuery, never query)
import { internalQuery } from "./_generated/server";

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").collect();
  },
});
```

Update trigger tests to use `internal.users.listAll` instead of `api.users.list`.

- [ ] **Step 4: Run and confirm tests fail**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-trigger.test.ts --reporter=verbose
```

Expected: Fail — `internal.auth.onCreate` not exported yet.

- [ ] **Step 5: Commit failing tests**

```bash
git add __tests__/auth-trigger.test.ts convex/users.ts
git commit -m "test: add failing auth trigger tests"
```

---

## Task 5: Implement `convex/lib/cors.ts` (make CORS tests pass)

**Files:**
- Modify: `convex/lib/cors.ts`

- [ ] **Step 1: Implement `getCorsHeaders`**

```typescript
// convex/lib/cors.ts
export function getCorsHeaders(): Record<string, string> {
  const origin = process.env.SITE_URL;
  if (!origin) {
    throw new Error("SITE_URL env var is required for CORS. Set it on the Convex deployment.");
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, better-auth.session_token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}
```

- [ ] **Step 2: Run CORS tests — expect pass**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-cors.test.ts --reporter=verbose
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/cors.ts
git commit -m "feat: add getCorsHeaders helper with required SITE_URL"
```

---

## Task 6: Update `convex/schema.ts`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `authId` field and index to users table**

Open `convex/schema.ts`. In the `users` table definition, add `authId: v.optional(v.string())` after `email`, and add `.index("by_auth_id", ["authId"])` after the existing indexes:

```typescript
users: defineTable({
  email: v.optional(v.string()),
  authId: v.optional(v.string()),          // Better Auth user _id (string UUID)
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
  .index("by_auth_id", ["authId"])
  .index("by_telegram_id", ["telegramId"])
  .index("by_whatsapp_phone", ["whatsappPhone"]),
```

- [ ] **Step 2: Verify schema compiles**

```bash
cd ~/Developer/ugent && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on schema.ts.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add authId field and by_auth_id index to users table"
```

---

## Task 7: Implement `convex/auth.ts` triggers (make trigger tests pass)

**Files:**
- Modify: `convex/auth.ts`

- [ ] **Step 1: Read current `convex/auth.ts` in full**

```bash
cat ~/Developer/ugent/convex/auth.ts
```

- [ ] **Step 2: Add `authFunctions` declaration and triggers to `createClient`**

Replace the existing `authComponent` declaration with the version that includes triggers. Keep all existing exports (`createAuth`, `getCurrentUser`). Add new exports for `triggersApi`:

```typescript
// convex/auth.ts
import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

// AuthFunctions reference — required for triggers to call internal mutations
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
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
        // Link: Better Auth component stores the Convex users._id so getAuthUser() returns it
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

// Export trigger handlers — required by Convex component system
export const { onCreate, onUpdate } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    plugins: [
      convex({ authConfig }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "UGent MedBot <noreply@resend.dev>",
            to: email,
            subject:
              type === "sign-in" ? "Your sign-in code" : "Your verification code",
            html: `<p>Your code is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`,
          });
        },
        expiresIn: 600,
      }),
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
```

- [ ] **Step 3: Run type check**

```bash
cd ~/Developer/ugent && npx tsc --noEmit 2>&1 | head -30
```

If TypeScript errors appear on `internal.auth` (circular reference), use a lazy getter:
```typescript
const authFunctions: AuthFunctions = {} as AuthFunctions;
Object.defineProperty(authFunctions, '__ref', { get: () => internal.auth });
```
(Only apply if the circular reference error appears.)

- [ ] **Step 4: Run trigger tests**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-trigger.test.ts --reporter=verbose
```

Expected: All 6 trigger tests pass. If tests fail due to `convex-test` API shape for `internal.auth.onCreate`, adjust the test call to match the actual exported function signature.

- [ ] **Step 5: Commit**

```bash
git add convex/auth.ts
git commit -m "feat: add user.onCreate/onUpdate triggers to Better Auth component"
```

---

## Task 8: Update `convex/http.ts` CORS

**Files:**
- Modify: `convex/http.ts`

- [ ] **Step 1: Replace hardcoded CORS headers with `getCorsHeaders()`**

```typescript
// convex/http.ts
import { httpRouter, httpActionGeneric } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { getCorsHeaders } from "./lib/cors";

const http = httpRouter();

// Handle CORS preflight for all auth routes
http.route({
  pathPrefix: "/api/auth/",
  method: "OPTIONS",
  handler: httpActionGeneric(async () => {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }),
});

authComponent.registerRoutes(http, createAuth);

export default http;
```

Note: `getCorsHeaders()` will throw at request time (not at module load) if `SITE_URL` is unset — this is intentional fail-fast behavior.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Developer/ugent && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/http.ts
git commit -m "feat: fix CORS — use specific SITE_URL origin instead of wildcard"
```

---

## Task 9: Rewrite `components/auth/email-otp-form.tsx`

**Files:**
- Modify: `components/auth/email-otp-form.tsx`

- [ ] **Step 1: Rewrite the component**

```typescript
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface EmailOtpFormProps {
  onSuccess: () => void;
}

function getErrorMessage(error: { status?: number; message?: string } | null): string {
  if (!error) return "";
  if (error.status === 429) return "Too many attempts. Please wait before trying again.";
  if (error.status === 400) return "Invalid code. Please try again.";
  return error.message ?? "Something went wrong. Please try again.";
}

export function EmailOtpForm({ onSuccess }: EmailOtpFormProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      return;
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
      setError(getErrorMessage(error));
      setLoading(false);
      return;
    }
    if (data) {
      onSuccess();
    }
    setLoading(false);
  };

  if (step === "email") {
    return (
      <form
        onSubmit={handleEmailSubmit}
        className="flex flex-col gap-4 w-full max-w-sm"
      >
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleOtpSubmit}
      className="flex flex-col gap-4 w-full max-w-sm"
    >
      <p className="text-sm text-gray-500">Enter the code sent to {email}</p>
      <input
        type="text"
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        required
        maxLength={6}
        className="border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => { setStep("email"); setError(""); }}
        className="text-sm text-gray-500 hover:underline"
      >
        ← Use a different email
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Run form tests**

```bash
cd ~/Developer/ugent && npx vitest run __tests__/auth-form.test.tsx --reporter=verbose
```

Expected: All 8 form tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/auth/email-otp-form.tsx
git commit -m "feat: rewrite EmailOtpForm to use { data, error } pattern"
```

---

## Task 10: Set `BETTER_AUTH_SECRET` and run full test suite

**Files:** none (deployment config only)

⚠ **Warning:** This step logs out all currently authenticated users.

- [ ] **Step 1: Set `BETTER_AUTH_SECRET` on Convex deployment**

```bash
cd ~/Developer/ugent && npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

Expected output: `Set BETTER_AUTH_SECRET` (or similar confirmation).

- [ ] **Step 2: Verify it's set**

```bash
npx convex env list | grep BETTER_AUTH_SECRET
```

Expected: `BETTER_AUTH_SECRET` appears (value redacted).

- [ ] **Step 3: Run full test suite**

```bash
cd ~/Developer/ugent && npx vitest run --reporter=verbose
```

Expected: All tests pass — auth-cors (4), auth-form (8), auth-trigger (6), plus existing tests.

If any test fails, fix before proceeding.

- [ ] **Step 4: Run type check**

```bash
cd ~/Developer/ugent && npx tsc --noEmit
```

Expected: no errors.

---

## Task 11: Deploy and smoke test

- [ ] **Step 1: Run `npx convex dev` and verify no errors**

```bash
cd ~/Developer/ugent && npx convex dev --once
```

Expected: functions push successfully, no type errors in generated files.

- [ ] **Step 2: Deploy to production**

```bash
cd ~/Developer/ugent && npx convex deploy
```

Expected: deployment succeeds with all functions.

- [ ] **Step 3: Run smoke test checklist**

Work through each item manually:

```
[ ] Navigate to /login — email input renders, no console errors
[ ] Enter valid email → "Continue" — OTP email received within 60 seconds
[ ] Enter correct 6-digit code → redirected to /chat
[ ] Refresh /chat — still logged in (session cookie persists)
[ ] Convex dashboard → users table → row exists with authId set and plan: "trial"
[ ] Browser DevTools → Application → Cookies → better-auth.session_token present
[ ] Sign out and sign back in — same users row (no duplicate created)
[ ] Convex dashboard → BETTER_AUTH_SECRET confirmed set
```

- [ ] **Step 4: Final commit**

```bash
cd ~/Developer/ugent && git add -A && git commit -m "feat: fix convex-better-auth OTP auth — CORS, triggers, form, secret"
```

---

## Task 12: Create `convex-ba` skill

**Files:**
- Create: `~/.claude/skills/convex-ba/SKILL.md`

- [ ] **Step 1: Create the skill directory and file**

See the design spec for the full skill content outline. The skill should cover:
- Setup checklist (env vars, BETTER_AUTH_SECRET, CORS, SITE_URL required)
- Trigger pattern (`onCreate` + `setUserId` — exact signatures from this implementation)
- `emailOTP { data, error }` form pattern with error type discrimination
- `convex-test` test templates
- Common errors and root causes (CORS wildcard, missing secret, version mismatch)
- Session persistence debugging checklist

The skill file must use SKILL.md frontmatter format with `name`, `description`, `filePattern`, and `bashPattern` for automatic injection.

---

## Running All Tests

```bash
# All tests at once
cd ~/Developer/ugent && npx vitest run --reporter=verbose

# By file
npx vitest run __tests__/auth-cors.test.ts
npx vitest run __tests__/auth-form.test.tsx
npx vitest run __tests__/auth-trigger.test.ts
```
