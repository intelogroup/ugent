export function getCorsHeaders(): Record<string, string> {
  const origin = process.env.SITE_URL;
  if (!origin) throw new Error("SITE_URL env var is required for CORS.");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, better-auth.session_token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}
