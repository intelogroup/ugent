import { query } from "./_generated/server";
import { BOOKS } from "../lib/chapters";

/**
 * Returns per-chapter engagement data for the progress heatmap.
 * Counts:
 *   - threadCount: how many threads exist scoped to this chapter
 *   - messageCount: how many messages sent in those threads
 *   - confidenceRating: 1-5 if rated, null otherwise
 *
 * Shape: Array<{ bookSlug, chapterNumber, threadCount, messageCount, confidenceRating }>
 */
export const getHeatmapData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.tokenIdentifier;

    // Fetch all threads for the user that have a chapterScope
    const allThreads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const chapterThreads = allThreads.filter((t) => t.chapterScope !== undefined);

    // Build a map: "bookSlug:chapterNumber" → thread IDs
    const threadMap: Record<string, string[]> = {};
    for (const thread of chapterThreads) {
      const key = `${thread.chapterScope!.bookSlug}:${thread.chapterScope!.chapterNumber}`;
      if (!threadMap[key]) threadMap[key] = [];
      threadMap[key].push(thread._id);
    }

    // Fetch all confidence ratings for user
    const ratings = await ctx.db
      .query("confidenceRatings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const ratingMap: Record<string, number> = {};
    for (const r of ratings) {
      ratingMap[`${r.bookSlug}:${r.chapterNumber}`] = r.rating;
    }

    // For each chapter in each book, compute counts
    const result: {
      bookSlug: string;
      bookName: string;
      chapterNumber: number;
      chapterTitle: string;
      threadCount: number;
      messageCount: number;
      confidenceRating: number | null;
    }[] = [];

    for (const book of BOOKS) {
      for (const chapter of book.chapters) {
        const key = `${book.slug}:${chapter.number}`;
        const threadIds = threadMap[key] ?? [];

        let messageCount = 0;
        if (threadIds.length > 0) {
          // Count messages across all threads for this chapter
          for (const threadId of threadIds) {
            const msgs = await ctx.db
              .query("messages")
              .withIndex("by_thread", (q) => q.eq("threadId", threadId as any))
              .collect();
            messageCount += msgs.length;
          }
        }

        result.push({
          bookSlug: book.slug,
          bookName: book.name,
          chapterNumber: chapter.number,
          chapterTitle: chapter.title,
          threadCount: threadIds.length,
          messageCount,
          confidenceRating: ratingMap[key] ?? null,
        });
      }
    }

    return result;
  },
});
