import { internalQuery, query } from "./_generated/server";
import { authComponent } from "./auth";

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
