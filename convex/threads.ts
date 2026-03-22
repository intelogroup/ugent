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

export const listRecentThreadsWithPreview = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const maxResults = limit ?? 10;
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(maxResults);

    // Fetch last message for each thread
    const threadsWithPreview = await Promise.all(
      threads.map(async (thread) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .order("desc")
          .first();

        const messageCount = (
          await ctx.db
            .query("messages")
            .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
            .collect()
        ).length;

        return {
          ...thread,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content.slice(0, 120),
                role: lastMessage.role,
                createdAt: lastMessage.createdAt,
              }
            : null,
          messageCount,
        };
      })
    );

    return threadsWithPreview.filter((t) => t.messageCount > 0);
  },
});
