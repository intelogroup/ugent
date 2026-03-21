// NOTE: TypeScript errors on `components` will resolve after running `npx convex dev`
import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import authConfig from "./auth.config";

// SITE_URL = frontend origin (e.g. http://localhost:3000 or https://ugent.app)
// CONVEX_SITE_URL = built-in Convex env var (e.g. https://posh-goat-161.convex.site)
const siteUrl = process.env.SITE_URL!;
const convexSiteUrl = process.env.CONVEX_SITE_URL!;

// authFunctions must point to internal.auth for triggers to work
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        const userId = await ctx.db.insert("users", {
          email: authUser.email ?? undefined,
          authId: authUser._id,
          plan: "trial",
          trialStartedAt: Date.now(),
          createdAt: Date.now(),
        });
        await authComponent.setUserId(ctx, authUser._id, userId);
      },
      onUpdate: async (ctx, newAuthUser, prevAuthUser) => {
        if (newAuthUser.email !== prevAuthUser.email) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q) => q.eq("authId", newAuthUser._id))
            .unique();
          if (user) {
            await ctx.db.patch(user._id, {
              email: newAuthUser.email ?? undefined,
            });
          }
        }
      },
    },
  },
});

// Export trigger functions so Convex can register them
export const { onCreate, onUpdate } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: convexSiteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    plugins: [
      convex({ authConfig }),
      crossDomain({ siteUrl }),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          // Lazy init: only create Resend when actually sending (not at module load)
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "UGent MedBot <noreply@resend.dev>",
            to: email,
            subject:
              type === "sign-in" ? "Your sign-in code" : "Your verification code",
            html: `<p>Your code is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`,
          });
        },
        expiresIn: 600,
      }),
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
