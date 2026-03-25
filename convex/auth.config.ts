/**
 * Convex auth configuration for WorkOS AuthKit.
 *
 * WorkOS issues two types of JWTs:
 *   1. SSO tokens (issuer: https://api.workos.com/) — for enterprise SSO
 *   2. User Management tokens (issuer: https://api.workos.com/user_management/<client-id>)
 *      — this is what withAuth() returns as `accessToken`
 *
 * Both are validated against the same JWKS endpoint.
 */

// Client ID is fixed per-environment — matches WORKOS_CLIENT_ID in Vercel env
const clientId = "client_01KMB7RBSPSQ9CAZ868HMS3FM2";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
};
