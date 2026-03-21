import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import betterAuthTest from "@convex-dev/better-auth/test";

describe("auth triggers — user persistence", () => {
  const modules = import.meta.glob("../convex/**/*.ts");

  function makeTest() {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    return t;
  }

  /**
   * Seed a user into the betterAuth component table so that
   * authComponent.setUserId() (called inside the onCreate trigger) can find
   * and patch it.  Returns the _id string that becomes authUser._id.
   */
  async function seedBetterAuthUser(
    t: ReturnType<typeof makeTest>,
    overrides: Partial<{
      email: string;
      name: string;
      emailVerified: boolean;
      createdAt: number;
      updatedAt: number;
    }> = {}
  ): Promise<string> {
    const now = Date.now();
    return await (t as any).runInComponent(
      "betterAuth",
      async (ctx: any) => {
        return await ctx.db.insert("user", {
          name: overrides.email ?? "test@example.com",
          email: overrides.email ?? "test@example.com",
          emailVerified: overrides.emailVerified ?? false,
          createdAt: overrides.createdAt ?? now,
          updatedAt: overrides.updatedAt ?? now,
          ...overrides,
        });
      }
    );
  }

  it("creates a users table entry when a Better Auth user is created", async () => {
    const t = makeTest();

    const authId = await seedBetterAuthUser(t, { email: "test@example.com" });
    const authUser = { _id: authId, email: "test@example.com", createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("test@example.com");
    expect(users[0].authId).toBe(authId);
  });

  it("sets plan to 'trial' and trialStartedAt on creation", async () => {
    const t = makeTest();

    const authId = await seedBetterAuthUser(t, { email: "newuser@example.com" });
    const authUser = { _id: authId, email: "newuser@example.com", createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].plan).toBe("trial");
    expect(users[0].trialStartedAt).toBeDefined();
  });

  it("creates a separate users table entry for each distinct onCreate call", async () => {
    const t = makeTest();

    // Seed two distinct betterAuth users — each gets their own Convex _id
    const authId1 = await seedBetterAuthUser(t, { email: "dup1@example.com" });
    const authId2 = await seedBetterAuthUser(t, { email: "dup2@example.com" });

    const authUser1 = { _id: authId1, email: "dup1@example.com", createdAt: Date.now() };
    const authUser2 = { _id: authId2, email: "dup2@example.com", createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser1 });
    });
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser2 });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    // Each distinct betterAuth user should produce exactly one users entry
    expect(users).toHaveLength(2);
    const emails = users.map((u: any) => u.email).sort();
    expect(emails).toEqual(["dup1@example.com", "dup2@example.com"]);
  });

  it("updates email in users table when Better Auth user email changes", async () => {
    const t = makeTest();

    const authId = await seedBetterAuthUser(t, { email: "old@example.com" });
    const authUser = { _id: authId, email: "old@example.com", createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser });
    });

    const updatedAuthUser = { ...authUser, email: "new@example.com" };
    const prevAuthUser = { ...authUser };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onUpdate, {
        model: "user",
        newDoc: updatedAuthUser,
        oldDoc: prevAuthUser,
      });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].email).toBe("new@example.com");
  });

  it("does not update users table when email is unchanged", async () => {
    const t = makeTest();

    const authId = await seedBetterAuthUser(t, { email: "same@example.com" });
    const authUser = { _id: authId, email: "same@example.com", createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser });
    });

    // onUpdate with same email
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onUpdate, {
        model: "user",
        newDoc: authUser,
        oldDoc: authUser,
      });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].email).toBe("same@example.com");
    expect(users).toHaveLength(1);
  });

  it("handles authUser with no email (emailless auth provider)", async () => {
    const t = makeTest();

    // Seed a betterAuth user without email (use empty string as email is required
    // in the component schema, but the trigger callback checks authUser.email)
    const authId = await seedBetterAuthUser(t, {
      email: "noemail-placeholder@example.com",
    });
    const authUser = { _id: authId, email: undefined as unknown as string, createdAt: Date.now() };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { model: "user", doc: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users).toHaveLength(1);
    expect(users[0].email).toBeUndefined();
    expect(users[0].authId).toBe(authId);
  });
});
