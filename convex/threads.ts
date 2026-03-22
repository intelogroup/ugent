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
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("chapterScope"), undefined)
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

/**
 * Create a new thread scoped to a specific chapter.
 * Always creates a fresh thread (no reuse) so each chapter study session is distinct.
 */
export const createChapterThread = mutation({
  args: {
    userId: v.string(),
    chapterScope: v.object({
      bookSlug: v.string(),
      chapterNumber: v.number(),
    }),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { userId, chapterScope, title }) => {
    return await ctx.db.insert("threads", {
      userId,
      platform: "web",
      chapterScope,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Archive the current active thread so a new one can be created.
 * Used by "New Chat" to start fresh without losing history.
 */
export const archiveThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    await ctx.db.patch(threadId, { archivedAt: Date.now() });
  },
});

/**
 * Get a single thread by ID (for resuming from history).
 */
export const getThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db.get(threadId);
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
