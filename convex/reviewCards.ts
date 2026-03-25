import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getAuthUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity.tokenIdentifier;
}

const INTERVALS_DAYS = [1, 3, 7, 14, 30];

function daysFromNowMs(days: number): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

/**
 * Sync bookmarks into review cards.
 * New bookmarks get a card due immediately. Deleted bookmarks have their cards removed.
 */
export const syncFromBookmarks = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Get all bookmarks
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get all review cards
    const existingCards = await ctx.db
      .query("reviewCards")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingByBookmark = new Map(
      existingCards.map((c) => [c.bookmarkId, c])
    );
    const bookmarkIds = new Set(bookmarks.map((b) => b._id));

    // Add cards for new bookmarks
    for (const bm of bookmarks) {
      if (!existingByBookmark.has(bm._id)) {
        await ctx.db.insert("reviewCards", {
          userId,
          bookmarkId: bm._id,
          question: bm.question.slice(0, 500),
          answer: bm.answer.slice(0, 1000),
          dueAt: Date.now(), // due immediately
          intervalStep: 0,
          reviewCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        // Update snapshot if bookmark content changed
        const card = existingByBookmark.get(bm._id)!;
        if (card.question !== bm.question.slice(0, 500) || card.answer !== bm.answer.slice(0, 1000)) {
          await ctx.db.patch(card._id, {
            question: bm.question.slice(0, 500),
            answer: bm.answer.slice(0, 1000),
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Remove cards for deleted bookmarks
    for (const card of existingCards) {
      if (!bookmarkIds.has(card.bookmarkId)) {
        await ctx.db.delete(card._id);
      }
    }
  },
});

/**
 * List all review cards for the current user.
 */
export const listCards = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    try {
      return await ctx.db
        .query("reviewCards")
        .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
        .collect();
    } catch {
      return [];
    }
  },
});

/**
 * List cards that are due for review (dueAt <= now).
 */
export const listDueCards = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    try {
      const now = Date.now();
      const cards = await ctx.db
        .query("reviewCards")
        .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
        .collect();
      return cards.filter((c) => c.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);
    } catch {
      return [];
    }
  },
});

/**
 * Rate a review card and schedule the next review.
 * Difficulty: "again" | "hard" | "good" | "easy"
 */
export const rateCard = mutation({
  args: {
    cardId: v.id("reviewCards"),
    difficulty: v.union(
      v.literal("again"),
      v.literal("hard"),
      v.literal("good"),
      v.literal("easy")
    ),
  },
  handler: async (ctx, { cardId, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    const card = await ctx.db.get(cardId);
    if (!card || card.userId !== userId) {
      throw new Error("Card not found");
    }

    let nextStep = card.intervalStep;

    switch (difficulty) {
      case "again":
        nextStep = 0;
        break;
      case "hard":
        // stay at current step
        break;
      case "good":
        nextStep = Math.min(nextStep + 1, INTERVALS_DAYS.length - 1);
        break;
      case "easy":
        nextStep = Math.min(nextStep + 2, INTERVALS_DAYS.length - 1);
        break;
    }

    await ctx.db.patch(cardId, {
      intervalStep: nextStep,
      dueAt: daysFromNowMs(INTERVALS_DAYS[nextStep]),
      reviewCount: card.reviewCount + 1,
      updatedAt: Date.now(),
    });

    return { intervalStep: nextStep, dueAt: daysFromNowMs(INTERVALS_DAYS[nextStep]) };
  },
});

/**
 * Get deck statistics for the current user.
 */
export const getDeckStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { due: 0, total: 0, reviewed: 0 };
    try {
      const now = Date.now();
      const cards = await ctx.db
        .query("reviewCards")
        .withIndex("by_user", (q) => q.eq("userId", identity.tokenIdentifier))
        .collect();
      return {
        due: cards.filter((c) => c.dueAt <= now).length,
        total: cards.length,
        reviewed: cards.filter((c) => c.reviewCount > 0).length,
      };
    } catch {
      return { due: 0, total: 0, reviewed: 0 };
    }
  },
});
