import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  // crossDomainClient stores the session in localStorage and sends it
  // via "better-auth-cookie" header — required when auth server (convex.site)
  // and frontend (localhost / vercel) are on different domains.
  plugins: [convexClient(), emailOTPClient(), crossDomainClient()],
});
