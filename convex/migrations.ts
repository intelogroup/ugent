import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * HTTP-safe wrapper around backfillWebThreadUserIds.
 * Call from Convex dashboard → Functions → Run.
 */
export const runBackfillWebThreadUserIds = action({
  args: { adminSecret: v.string() },
  handler: async (ctx, { adminSecret }) => {
    if (adminSecret !== process.env.CONVEX_ADMIN_SECRET) {
      throw new Error("Unauthorized");
    }
    return await ctx.runMutation(internal.threads.backfillWebThreadUserIds, {});
  },
});
