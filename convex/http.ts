import { httpRouter, httpActionGeneric } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { getCorsHeaders } from "./lib/cors";

const http = httpRouter();

// Handle CORS preflight for all auth routes
http.route({
  pathPrefix: "/api/auth/",
  method: "OPTIONS",
  handler: httpActionGeneric(async () => {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }),
});

authComponent.registerRoutes(http, createAuth);

export default http;
