import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAuthUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity.tokenIdentifier;
}

/**
 * Toggle a bookmark on an assistant message.
 * If already bookmarked, removes it. Otherwise, creates it with a snapshot
 * of the preceding user question + the assistant answer.
 */
export const toggleBookmark = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);

    // Check if already bookmarked
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", messageId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }

    // Get the message to bookmark
    const message = await ctx.db.get(messageId);
    if (!message || message.role !== "assistant") {
      throw new Error("Can only bookmark assistant messages");
    }

    // Find the preceding user message in the same thread
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", message.threadId))
      .order("asc")
      .collect();

    const msgIndex = allMessages.findIndex((m) => m._id === messageId);
    const userMsg = msgIndex > 0 ? allMessages[msgIndex - 1] : null;

    await ctx.db.insert("bookmarks", {
      userId,
      messageId,
      threadId: message.threadId,
      question: userMsg?.content?.slice(0, 500) ?? "",
      answer: message.content.slice(0, 1000),
      createdAt: Date.now(),
    });

    return { bookmarked: true };
  },
});

/**
 * Check if a specific message is bookmarked by the current user.
 */
export const isBookmarked = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    try {
      const existing = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_message", (q) =>
          q.eq("userId", identity.tokenIdentifier).eq("messageId", messageId)
        )
        .first();

      return !!existing;
    } catch {
      return false;
    }
  },
});

/**
 * List all bookmarks for the current user, newest first.
 */
export const listBookmarks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    try {
      return await ctx.db
        .query("bookmarks")
        .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
        .order("desc")
        .take(limit ?? 50);
    } catch {
      return [];
    }
  },
});
