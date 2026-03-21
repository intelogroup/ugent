import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// registerRoutes with cors:true uses convex-helpers corsRouter to add
// Access-Control-Allow-Origin on every auth response (not just preflight).
// trustedOrigins is read from the betterAuth config (SITE_URL).
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
