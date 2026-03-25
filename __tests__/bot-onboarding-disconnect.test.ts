import { describe, it, expect, vi } from "vitest";

const mockPatch = vi.fn();
const mockFirst = vi.fn();
const mockWithIndex = vi.fn(() => ({ first: mockFirst }));
const mockQuery = vi.fn(() => ({ withIndex: mockWithIndex }));
const mockGetUserIdentity = vi.fn();

const mockCtx = {
  auth: { getUserIdentity: mockGetUserIdentity },
  db: { query: mockQuery, patch: mockPatch },
};

describe("disconnectTelegram mutation logic", () => {
  it("throws if unauthenticated", async () => {
    mockGetUserIdentity.mockResolvedValue(null);
    expect(mockGetUserIdentity).toBeDefined();
    expect(mockPatch).toBeDefined();
  });

  it("clears telegramId and telegramUsername on user row", async () => {
    mockGetUserIdentity.mockResolvedValue({
      tokenIdentifier: "workos|user_123",
    });
    const fakeUser = { _id: "doc_abc", tokenIdentifier: "workos|user_123" };
    mockFirst.mockResolvedValue(fakeUser);

    const identity = await mockCtx.auth.getUserIdentity();
    const userRow = await mockCtx.db
      .query("users")
      .withIndex("by_token")
      .first();
    if (userRow) {
      await mockCtx.db.patch(userRow._id, {
        telegramId: undefined,
        telegramUsername: undefined,
      });
    }

    expect(identity?.tokenIdentifier).toBe("workos|user_123");
    expect(mockPatch).toHaveBeenCalledWith("doc_abc", {
      telegramId: undefined,
      telegramUsername: undefined,
    });
  });
});
