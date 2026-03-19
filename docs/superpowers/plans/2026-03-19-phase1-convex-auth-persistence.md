# Phase 1: Convex + Better Auth + Persistent Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Convex as the database backend, Better Auth email OTP login, and persistent chat history to the existing UGent MedBot web app.

**Architecture:** Better Auth (`@convex-dev/better-auth`) runs inside Convex — auth data lives in the same DB as chat data. `useChat` from AI SDK handles streaming; Convex mutations persist messages before/after. Route protection via `convexBetterAuthNextJs` middleware.

**Tech Stack:** Convex, `@convex-dev/better-auth`, `better-auth`, `convex-test` (backend tests), Vitest + @testing-library/react (component tests), Resend (OTP email, already in deps).

**Spec:** `docs/superpowers/specs/2026-03-19-ugent-platform-design.md`

---

## Prerequisites

- [ ] Upgrade Vercel plan to Pro (`maxDuration = 30` already in `app/api/chat/route.ts` — Hobby will fail)
- [ ] Have `RESEND_API_KEY` in `.env.local` (already present)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `convex/schema.ts` | Create | Full DB schema: users, threads, messages, telegramConnectTokens, jobs |
| `convex/auth.ts` | Create | Better Auth config: emailOTP plugin + Resend transport |
| `convex/http.ts` | Create | HTTP router — mounts Better Auth auth routes |
| `convex/users.ts` | Create | Convex queries: `getCurrentUser` |
| `convex/threads.ts` | Create | Convex mutations/queries: `getOrCreateWebThread`, `listUserThreads` |
| `convex/messages.ts` | Create | Convex mutations/queries: `addMessage`, `listByThread` |
| `lib/auth-client.ts` | Create | Better Auth client instance (`createAuthClient` + `emailOTPClient`) |
| `lib/convex.tsx` | Create | `ConvexClientProvider` — client-side Convex + auth provider tree |
| `middleware.ts` | Create | `convexBetterAuthNextJs` — protect all routes except `/login` |
| `app/login/page.tsx` | Create | Login page: email input → OTP input → redirect |
| `components/auth/email-otp-form.tsx` | Create | Two-step form: email → OTP code |
| `app/layout.tsx` | Modify | Wrap `AppLayout` with `ConvexClientProvider` |
| `components/chat/chat-interface.tsx` | Modify | Load history via `useQuery`, persist via `onFinish` |
| `app/api/chat/route.ts` | Modify | Add auth guard — return 401 if no valid session |
| `package.json` | Modify | Add `convex`, `better-auth`, `@convex-dev/better-auth` |
| `.env.local` | Modify | Add `CONVEX_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |

---

## Task 1: Install Dependencies + Init Convex

**Files:**
- Modify: `package.json`
- Create: `convex/` directory (via `npx convex dev`)

- [ ] **Step 1: Install packages**

```bash
npm install convex better-auth @convex-dev/better-auth
npm install --save-dev convex-test
```

- [ ] **Step 2: Initialize Convex project**

```bash
npx convex dev
```

Follow prompts: create new project, log in if needed. This creates `convex.json` and `convex/_generated/` directory.

- [ ] **Step 3: Verify Convex generated files exist**

```bash
ls convex/_generated/
```

Expected output: `api.d.ts  api.js  dataModel.d.ts  react.d.ts  server.d.ts`

- [ ] **Step 4: Add env vars to `.env.local`**

```bash
# Add these lines to .env.local (CONVEX_URL is printed by `npx convex dev`)
CONVEX_URL=https://<your-deployment>.convex.cloud
BETTER_AUTH_SECRET=<generate: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json convex.json convex/_generated/ .env.local
git commit -m "chore: install convex + better-auth, init convex project"
```

---

## Task 2: Define Convex Schema

**Files:**
- Create: `convex/schema.ts`
- Create: `convex/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// convex/schema.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";

describe("schema", () => {
  it("has required tables", () => {
    const tableNames = Object.keys(schema.tables);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("threads");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("telegramConnectTokens");
    expect(tableNames).toContain("jobs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run convex/schema.test.ts
```

Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: Create the schema**

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.optional(v.string()),
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
    .index("by_telegram_id", ["telegramId"])
    .index("by_whatsapp_phone", ["whatsappPhone"]),

  telegramConnectTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  threads: defineTable({
    userId: v.id("users"),
    platform: v.union(v.literal("web"), v.literal("telegram"), v.literal("whatsapp")),
    title: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "updatedAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageAnnotations: v.optional(v.array(v.any())),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  jobs: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("research"), v.literal("digest")),
    researchTopic: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId", "createdAt"]),
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run convex/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/schema.test.ts
git commit -m "feat: define convex schema (users, threads, messages, jobs)"
```

---

## Task 3: Configure Better Auth

**Files:**
- Create: `convex/auth.ts`
- Create: `convex/http.ts`

> **Before writing code:** Check the latest Better Auth Convex integration docs at `https://labs.convex.dev/better-auth` — APIs change between minor versions.

- [ ] **Step 1: Create Better Auth config**

```typescript
// convex/auth.ts
import { convexAuth } from "@convex-dev/better-auth";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const { auth, signIn, signOut, store } = convexAuth({
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await resend.emails.send({
          from: "UGent MedBot <noreply@yourdomain.com>",
          to: email,
          subject: type === "sign-in" ? "Your sign-in code" : "Your verification code",
          html: `<p>Your code is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`,
        });
      },
      expiresIn: 600, // 10 minutes
    }),
  ],
});
```

- [ ] **Step 2: Create HTTP router**

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mount Better Auth routes (handles /api/auth/* paths)
auth.addHttpRoutes(http);

export default http;
```

- [ ] **Step 3: Push schema + auth to Convex dev**

```bash
npx convex dev --once
```

Expected: "Convex functions ready" with no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/auth.ts convex/http.ts
git commit -m "feat: configure better-auth with email OTP + resend transport"
```

---

## Task 4: Convex Backend Functions

**Files:**
- Create: `convex/users.ts`
- Create: `convex/threads.ts`
- Create: `convex/messages.ts`
- Create: `convex/users.test.ts`
- Create: `convex/threads.test.ts`
- Create: `convex/messages.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// convex/threads.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

test("getOrCreateWebThread creates thread for new user", async () => {
  const t = convexTest(schema);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      plan: "trial",
      trialStartedAt: Date.now(),
      createdAt: Date.now(),
    });
  });

  const threadId = await t.mutation(api.threads.getOrCreateWebThread, { userId });
  expect(threadId).toBeDefined();

  // Calling again returns same thread
  const threadId2 = await t.mutation(api.threads.getOrCreateWebThread, { userId });
  expect(threadId2).toEqual(threadId);
});
```

```typescript
// convex/messages.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

test("addMessage stores message and returns id", async () => {
  const t = convexTest(schema);

  const { userId, threadId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "test@example.com",
      plan: "trial",
      trialStartedAt: Date.now(),
      createdAt: Date.now(),
    });
    const threadId = await ctx.db.insert("threads", {
      userId,
      platform: "web",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { userId, threadId };
  });

  const msgId = await t.mutation(api.messages.addMessage, {
    threadId,
    role: "user",
    content: "What is nephritic syndrome?",
  });

  expect(msgId).toBeDefined();

  const messages = await t.query(api.messages.listByThread, { threadId });
  expect(messages).toHaveLength(1);
  expect(messages[0].content).toBe("What is nephritic syndrome?");
  expect(messages[0].role).toBe("user");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run convex/threads.test.ts convex/messages.test.ts
```

Expected: FAIL — functions not defined

- [ ] **Step 3: Write failing test for `users.ts`**

```typescript
// convex/users.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

test("getCurrentUser returns null when unauthenticated", async () => {
  const t = convexTest(schema);
  const user = await t.query(api.users.getCurrentUser, {});
  expect(user).toBeNull();
});

test("getCurrentUser returns the authenticated user", async () => {
  const t = convexTest(schema);
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "test@example.com",
      plan: "trial",
      trialStartedAt: Date.now(),
      createdAt: Date.now(),
    });
  });
  // Run as authenticated user
  const user = await t.withIdentity({ subject: userId }).query(api.users.getCurrentUser, {});
  expect(user?._id).toEqual(userId);
});
```

- [ ] **Step 4: Run test to confirm it fails**

```bash
npx vitest run convex/users.test.ts
```

Expected: FAIL — module not defined

- [ ] **Step 5: Implement users.ts**

```typescript
// convex/users.ts
import { query } from "./_generated/server";
import { auth } from "./auth";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
```

- [ ] **Step 6: Run users test to confirm it passes**

```bash
npx vitest run convex/users.test.ts
```

Expected: PASS

- [ ] **Step 4: Implement threads.ts**

```typescript
// convex/threads.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateWebThread = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("platform"), "web"))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("threads", {
      userId,
      platform: "web",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listUserThreads = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
```

- [ ] **Step 5: Implement messages.ts**

```typescript
// convex/messages.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageAnnotations: v.optional(v.array(v.any())),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Spec requirement: reject writes for expired plans (server-side guard)
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    const user = await ctx.db.get(thread.userId);
    if (!user) throw new Error("User not found");
    const now = Date.now();
    const trialExpired =
      user.plan === "trial" && now > user.trialStartedAt + 30 * 24 * 60 * 60 * 1000;
    if (user.plan === "expired" || trialExpired) {
      throw new Error("trial_expired");
    }

    const msgId = await ctx.db.insert("messages", {
      ...args,
      createdAt: now,
    });
    await ctx.db.patch(args.threadId, { updatedAt: now });
    return msgId;
  },
});

export const listByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx vitest run convex/threads.test.ts convex/messages.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/users.ts convex/threads.ts convex/messages.ts \
        convex/users.test.ts convex/threads.test.ts convex/messages.test.ts
git commit -m "feat: add convex backend functions for users, threads, messages (with trial guard)"
```

---

## Task 5: Next.js Providers + Middleware + Login Page

**Files:**
- Create: `lib/convex.tsx`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `components/auth/email-otp-form.tsx`
- Modify: `app/layout.tsx`

> **Before writing code:** Check `https://labs.convex.dev/better-auth/framework-guides/next` for the exact `convexBetterAuthNextJs` API.

- [ ] **Step 1: Write failing test for email OTP form**

```typescript
// components/auth/email-otp-form.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmailOtpForm } from "./email-otp-form";

describe("EmailOtpForm", () => {
  it("shows email input on first step", () => {
    render(<EmailOtpForm onSuccess={() => {}} />);
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/code/i)).not.toBeInTheDocument();
  });

  it("shows OTP input after email submission", async () => {
    const mockSendOtp = vi.fn().mockResolvedValue(undefined);
    render(<EmailOtpForm onSuccess={() => {}} onSendOtp={mockSendOtp} />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/code/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run components/auth/email-otp-form.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Add `NEXT_PUBLIC_CONVEX_URL` to `.env.local` first (required before any client code)**

```bash
# Add to .env.local — same value as CONVEX_URL but with NEXT_PUBLIC_ prefix
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Create Better Auth client instance**

> Check `https://www.better-auth.com/docs/plugins/email-otp` for the exact `emailOTPClient` import path before writing.

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
  plugins: [emailOTPClient()],
});
```

- [ ] **Step 5: Create Convex client provider**

```typescript
// lib/convex.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ConvexBetterAuthProvider>{children}</ConvexBetterAuthProvider>
    </ConvexProvider>
  );
}
```

- [ ] **Step 4: Create middleware**

```typescript
// middleware.ts
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export default convexBetterAuthNextJs({
  // Redirect unauthenticated users to /login
  loginPage: "/login",
  // Public routes that don't require auth
  publicRoutes: ["/login", "/api/auth/(.*)"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Create email OTP form component**

```typescript
// components/auth/email-otp-form.tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface EmailOtpFormProps {
  onSuccess: () => void;
  // Injected in tests to avoid real network calls
  onSendOtp?: (email: string) => Promise<void>;
}

export function EmailOtpForm({ onSuccess, onSendOtp }: EmailOtpFormProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (onSendOtp) {
        await onSendOtp(email);
      } else {
        // Better Auth emailOTP client — check exact method name at
        // https://www.better-auth.com/docs/plugins/email-otp
        await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      }
      setStep("otp");
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authClient.signIn.emailOtp({ email, otp });
      onSuccess();
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4 w-full max-w-sm">
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
    <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4 w-full max-w-sm">
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
        onClick={() => setStep("email")}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        Use a different email
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create login page**

```typescript
// app/login/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { EmailOtpForm } from "@/components/auth/email-otp-form";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6">
        <Bot className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">UGent MedBot</h1>
      <p className="text-gray-500 text-sm mb-8">Sign in to continue</p>
      <EmailOtpForm onSuccess={() => router.push("/")} />
    </div>
  );
}
```

- [ ] **Step 7: Update app/layout.tsx to add providers**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/ui/app-layout";
import { ConvexClientProvider } from "@/lib/convex";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "U-Gent Medical Chatbot",
  description: "A medical chatbot for Pathoma and First Aid study assistance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          <AppLayout>{children}</AppLayout>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Add `NEXT_PUBLIC_CONVEX_URL` to `.env.local`**

```bash
# Add to .env.local (same value as CONVEX_URL but prefixed for client-side)
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

- [ ] **Step 9: Run component test to confirm it passes**

```bash
npx vitest run components/auth/email-otp-form.test.tsx
```

Expected: PASS

- [ ] **Step 10: Start dev server and manually verify**

```bash
npm run dev
```

Navigate to `http://localhost:3000` — should redirect to `/login`. Enter email, receive OTP via email, enter code, land on `/`.

- [ ] **Step 11: Commit**

```bash
git add lib/convex.tsx lib/auth-client.ts middleware.ts app/login/page.tsx \
        components/auth/email-otp-form.tsx components/auth/email-otp-form.test.tsx \
        app/layout.tsx .env.local
git commit -m "feat: add convex providers, better-auth middleware, email OTP login page"
```

---

## Task 6: Chat Persistence

**Files:**
- Modify: `components/chat/chat-interface.tsx`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Write failing test for auth guard on chat route**

```typescript
// app/api/chat/route.test.ts
import { describe, it, expect, vi } from "vitest";

describe("POST /api/chat auth guard", () => {
  it("returns 401 when no auth session", async () => {
    // Mock the Better Auth server session check to return null
    vi.mock("@/lib/auth-server", () => ({
      getServerSession: vi.fn().mockResolvedValue(null),
    }));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run app/api/chat/route.test.ts
```

Expected: FAIL — no 401 returned

- [ ] **Step 3: Create `lib/auth-server.ts` — server-side session helper**

> **Before writing:** Check `https://www.better-auth.com/docs/concepts/session-management#get-session` for the exact `auth.api.getSession` signature. The Convex `auth` instance exposes `auth.api.getSession({ headers })`.

```typescript
// lib/auth-server.ts
import { auth } from "@/convex/auth";

/**
 * Get the current session in a Next.js Route Handler.
 * Returns null if unauthenticated.
 */
export async function getServerSession(req: Request) {
  return await auth.api.getSession({ headers: req.headers });
}
```

- [ ] **Step 4: Add auth guard to `/api/chat/route.ts`**

Add at the top of the file and at the start of the `POST` handler:

```typescript
// Add import at top of file
import { getServerSession } from "@/lib/auth-server";

// Add as FIRST lines inside POST handler, before any existing logic:
const session = await getServerSession(req);
if (!session?.user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 5: Run auth guard test to confirm it passes**

```bash
npx vitest run app/api/chat/route.test.ts
```

Expected: PASS

- [ ] **Step 5: Update `ChatInterface` to load history and persist messages**

```typescript
// components/chat/chat-interface.tsx  (full replacement)
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import { useQuery, useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { Bot, Sparkles } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { InputBar } from './input-bar';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const STARTER_PROMPTS = [
  "Nephritic vs Nephrotic syndrome",
  "Signs of Hyperkalemia",
  "Type II Hypersensitivity examples"
];

export function ChatInterface() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const getOrCreateThread = useMutation(api.threads.getOrCreateWebThread);
  const addMessage = useMutation(api.messages.addMessage);

  // useState (not useRef) so component re-renders when thread resolves
  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null);

  useEffect(() => {
    if (currentUser?._id && !threadId) {
      getOrCreateThread({ userId: currentUser._id }).then(setThreadId);
    }
  }, [currentUser?._id, getOrCreateThread, threadId]);

  // Load history — "skip" until threadId is known
  const persistedMessages = useQuery(
    api.messages.listByThread,
    threadId ? { threadId } : "skip"
  );

  // Block render until thread AND its messages are both loaded
  // (persistedMessages is undefined while loading, array when done)
  const ready = isAuthenticated && currentUser && threadId && persistedMessages !== undefined;

  const initialMessages = persistedMessages?.map((m) => ({
    id: m._id,
    role: m.role as "user" | "assistant",
    content: m.content,
    annotations: m.imageAnnotations,
  })) ?? [];

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    // Only provided once at mount — guaranteed non-empty after ready check above
    initialMessages,
    onFinish: async (message) => {
      if (!threadId) return;
      await addMessage({
        threadId,
        role: "assistant",
        content: typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
        imageAnnotations: (message.annotations as any[]) ?? undefined,
      });
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmitWithPersist = async (e: React.FormEvent) => {
    if (!threadId || !input.trim()) return;
    await addMessage({ threadId, role: "user", content: input });
    handleSubmit(e);
  };

  const onStarterPromptClick = async (prompt: string) => {
    if (threadId) {
      await addMessage({ threadId, role: "user", content: prompt });
    }
    append({ role: 'user', content: prompt });
  };

  // Show nothing until auth + thread + history are all ready
  if (!ready) return null;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-6 animate-in fade-in duration-700">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-sm border border-blue-50">
              <Bot className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">How can I help you?</h1>
            <p className="text-gray-500 mb-10 max-w-xs text-[15px] leading-relaxed">
              I'm your Step 1 study assistant, trained on Pathoma and First Aid.
            </p>
            <div className="grid gap-3 w-full max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onStarterPromptClick(prompt)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-left text-[15px] font-medium text-gray-700 transition-all flex items-center justify-between group"
                >
                  <span>{prompt}</span>
                  <Sparkles className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex w-full mb-6 justify-start animate-in fade-in duration-300">
                <div className="flex max-w-[85%] md:max-w-[80%] gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
                      <Bot className="w-6 h-6 animate-pulse" />
                    </div>
                  </div>
                  <div className="p-3.5 px-4 bg-gray-50 rounded-2xl flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>
      <div className="bg-white">
        <InputBar
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmitWithPersist}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all existing tests pass + new tests pass

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

1. Navigate to `http://localhost:3000` → redirects to `/login`
2. Enter email → receive OTP → enter code → land on `/`
3. Ask "What is nephritic syndrome?"
4. Close the browser tab
5. Re-open `http://localhost:3000` — chat history reappears ✓

- [ ] **Step 8: Commit**

```bash
git add components/chat/chat-interface.tsx app/api/chat/route.ts \
        app/api/chat/route.test.ts lib/auth-server.ts
git commit -m "feat: persist chat messages to convex, auth guard on /api/chat"
```

---

## Task 7: Deploy to Vercel + Verify

**Files:**
- Modify: `vercel.json` (if needed for env vars)

- [ ] **Step 1: Push Convex schema to production**

```bash
npx convex deploy
```

Note the production deployment URL — add it to Vercel env vars.

- [ ] **Step 2: Add env vars to Vercel**

```bash
vercel env add CONVEX_URL production
vercel env add NEXT_PUBLIC_CONVEX_URL production
vercel env add BETTER_AUTH_SECRET production
vercel env add BETTER_AUTH_URL production
# BETTER_AUTH_URL should be your production domain: https://ugent2.vercel.app
```

- [ ] **Step 3: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 4: Verify production**

1. Visit `https://ugent2.vercel.app` → redirects to `/login`
2. Sign in with email OTP
3. Ask a question, close tab, reopen → history persists ✓

- [ ] **Step 5: Commit any config changes**

```bash
git add vercel.json  # if modified
git commit -m "chore: add convex + better-auth env vars to vercel production"
```

---

## Done Criteria

- [ ] Unauthenticated users redirected to `/login`
- [ ] Email OTP sign-in works end-to-end (Resend delivers the code)
- [ ] Chat history persists across browser sessions
- [ ] `/api/chat` returns 401 for unauthenticated requests
- [ ] All Convex backend tests pass (`npx vitest run convex/`)
- [ ] Production deployment works on Vercel Pro
