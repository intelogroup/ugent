import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

test("getCurrentUser returns null when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  const result = await t.query(api.auth.getCurrentUser, {});
  expect(result).toBeNull();
});

test("storeUser throws when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.auth.storeUser, { email: "test@example.com" })
  ).rejects.toThrow("Not authenticated");
});

test("storeUser creates user on first call", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_123", email: "test@example.com" });
  const userId = await asUser.mutation(api.auth.storeUser, {
    name: "Test User",
    email: "test@example.com",
  });
  expect(userId).toBeTruthy();
});

test("storeUser is idempotent — second call updates, not inserts", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_123", email: "test@example.com" });
  const id1 = await asUser.mutation(api.auth.storeUser, { name: "First" });
  const id2 = await asUser.mutation(api.auth.storeUser, { name: "Updated" });
  expect(id1).toEqual(id2);
});

test("getCurrentUser returns user after storeUser", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_456", email: "user@example.com" });
  await asUser.mutation(api.auth.storeUser, { email: "user@example.com" });
  const user = await asUser.query(api.auth.getCurrentUser, {});
  expect(user?.email).toBe("user@example.com");
});

test("getByEmail returns user when found", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ tokenIdentifier: "workos|user_789", email: "find@example.com" });
  await asUser.mutation(api.auth.storeUser, { email: "find@example.com" });
  const user = await t.query(api.auth.getByEmail, { email: "find@example.com" });
  expect(user?.email).toBe("find@example.com");
});

test("getByEmail returns null when not found", async () => {
  const t = convexTest(schema, modules);
  const user = await t.query(api.auth.getByEmail, { email: "notfound@example.com" });
  expect(user).toBeNull();
});
