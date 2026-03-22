import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

/**
 * Verify the caller owns the thread. Throws if unauthenticated or thread
 * belongs to a different user.
 */
async function assertThreadOwner(
  ctx: any,
  threadId: any,
): Promise<{ thread: any; authUser: any }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const authUser = await authComponent.getAuthUser(ctx);
  if (!authUser) throw new Error("Unauthenticated");

  const thread = await ctx.db.get(threadId);
  if (!thread) throw new Error("Thread not found");

  // thread.userId is a Better Auth user ID (string UUID)
  if (thread.userId !== authUser._id) {
    throw new Error("Not authorized to access this thread");
  }

  return { thread, authUser };
}

export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageAnnotations: v.optional(v.array(v.any())),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertThreadOwner(ctx, args.threadId);

    const msgId = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return msgId;
  },
});

export const listByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    await assertThreadOwner(ctx, threadId);

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});
