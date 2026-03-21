import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateWebThread = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("platform"), "web"),
          q.eq(q.field("archivedAt"), undefined)
        )
      )
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
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
