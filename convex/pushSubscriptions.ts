import { v } from "convex/values";
import { mutation, internalQuery } from "./_generated/server";

/**
 * Upsert a web push subscription for the authenticated user.
 * If a subscription with the same endpoint already exists, it is replaced
 * (keys may rotate after a browser update).
 */
export const saveSubscription = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, { userId, endpoint, p256dh, auth }) => {
    // Remove any existing subscription for this endpoint to avoid duplicates
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { p256dh, auth });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint,
      p256dh,
      auth,
      createdAt: Date.now(),
    });
  },
});

/**
 * Remove a push subscription (user opted out).
 */
export const removeSubscription = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
  },
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal: fetch all push subscriptions (used by cron to send notifications).
 */
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("pushSubscriptions").collect(),
});
