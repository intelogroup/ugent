import { internalQuery, query } from "./_generated/server";

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});
