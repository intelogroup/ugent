import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

async function getAuthUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const authUser = await authComponent.getAuthUser(ctx);
  if (!authUser) throw new Error("Unauthenticated");
  return authUser._id;
}

/**
 * Set or update a confidence rating for a specific chapter.
 * Rating: 1 (no idea) to 5 (mastered)
 */
export const setRating = mutation({
  args: {
    bookSlug: v.string(),
    chapterNumber: v.number(),
    rating: v.number(),
  },
  handler: async (ctx, { bookSlug, chapterNumber, rating }) => {
    const userId = await getAuthUserId(ctx);

    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Check for existing rating
    const existing = await ctx.db
      .query("confidenceRatings")
      .withIndex("by_user_chapter", (q) =>
        q.eq("userId", userId).eq("bookSlug", bookSlug).eq("chapterNumber", chapterNumber)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("confidenceRatings", {
      userId,
      bookSlug,
      chapterNumber,
      rating,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Get the confidence rating for a specific chapter.
 */
export const getRating = query({
  args: {
    bookSlug: v.string(),
    chapterNumber: v.number(),
  },
  handler: async (ctx, { bookSlug, chapterNumber }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return null;

      return await ctx.db
        .query("confidenceRatings")
        .withIndex("by_user_chapter", (q) =>
          q
            .eq("userId", authUser._id)
            .eq("bookSlug", bookSlug)
            .eq("chapterNumber", chapterNumber)
        )
        .first();
    } catch {
      return null;
    }
  },
});

/**
 * Get all confidence ratings for the current user.
 * Returns a map of "bookSlug:chapterNumber" → rating for efficient lookups.
 */
export const listRatings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return {};

      const ratings = await ctx.db
        .query("confidenceRatings")
        .withIndex("by_user", (q) => q.eq("userId", authUser._id))
        .collect();

      const map: Record<string, number> = {};
      for (const r of ratings) {
        map[`${r.bookSlug}:${r.chapterNumber}`] = r.rating;
      }
      return map;
    } catch {
      return {};
    }
  },
});

/**
 * Get average confidence across all rated chapters for the current user.
 */
export const getAverageConfidence = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return null;

      const ratings = await ctx.db
        .query("confidenceRatings")
        .withIndex("by_user", (q) => q.eq("userId", authUser._id))
        .collect();

      if (ratings.length === 0) return null;

      const avg =
        ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      return {
        average: Math.round(avg * 10) / 10,
        totalRated: ratings.length,
      };
    } catch {
      return null;
    }
  },
});
