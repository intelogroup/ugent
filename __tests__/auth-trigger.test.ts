import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

describe("auth triggers — user persistence", () => {
  it("creates a users table entry when a Better Auth user is created", async () => {
    const t = convexTest(schema);

    // Simulate trigger: create a Better Auth user object
    const authUser = {
      _id: "auth_user_123",
      email: "test@example.com",
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      // Call the onCreate trigger manually
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    // Verify a users table entry was created
    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("test@example.com");
    expect(users[0].authId).toBe("auth_user_123");
  });

  it("sets plan to 'trial' and trialStartedAt on creation", async () => {
    const t = convexTest(schema);

    const authUser = {
      _id: "auth_user_456",
      email: "newuser@example.com",
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].plan).toBe("trial");
    expect(users[0].trialStartedAt).toBeDefined();
  });

  it("does not create duplicate users table entry on second onCreate", async () => {
    const t = convexTest(schema);

    const authUser = {
      _id: "auth_user_789",
      email: "dup@example.com",
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    // Should only have 1 user despite 2 onCreate calls
    expect(users).toHaveLength(1);
  });

  it("updates email in users table when Better Auth user email changes", async () => {
    const t = convexTest(schema);

    const authUser = {
      _id: "auth_user_update",
      email: "old@example.com",
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    const updatedAuthUser = { ...authUser, email: "new@example.com" };
    const prevAuthUser = { ...authUser };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onUpdate, {
        user: updatedAuthUser,
        prevUser: prevAuthUser,
      });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].email).toBe("new@example.com");
  });

  it("does not update users table when email is unchanged", async () => {
    const t = convexTest(schema);

    const authUser = {
      _id: "auth_user_noupdate",
      email: "same@example.com",
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    // onUpdate with same email
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onUpdate, {
        user: authUser,
        prevUser: authUser,
      });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users[0].email).toBe("same@example.com");
    expect(users).toHaveLength(1);
  });

  it("handles authUser with no email (emailless auth provider)", async () => {
    const t = convexTest(schema);

    const authUser = {
      _id: "auth_user_noeią",
      email: undefined,
      createdAt: Date.now(),
    };

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.auth.onCreate, { user: authUser });
    });

    const users = await t.run(async (ctx) => {
      return await ctx.runQuery(internal.users.listAll, {});
    });

    expect(users).toHaveLength(1);
    expect(users[0].email).toBeUndefined();
    expect(users[0].authId).toBe("auth_user_noeią");
  });
});
