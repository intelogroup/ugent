import { internalQuery, query } from "./_generated/server";
import { authComponent } from "./auth";

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // getAuthUser throws ConvexError("Unauthenticated") when there's no session,
    // which crashes useQuery. Guard with identity check first.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    try {
      return await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
  },
});
