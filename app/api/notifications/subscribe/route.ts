/**
 * POST /api/notifications/subscribe
 * Saves (or refreshes) a Web Push subscription for the authenticated user.
 *
 * DELETE /api/notifications/subscribe
 * Removes a Web Push subscription.
 *
 * Returns the VAPID public key on GET so the client can call
 * PushManager.subscribe() with the correct applicationServerKey.
 */
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  return Response.json({ publicKey });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Invalid subscription object" }, { status: 400 });
  }

  try {
    await fetchAuthMutation(req, api.pushSubscriptions.saveSubscription, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unauthenticated") || msg.includes("Unauthorized")) {
      return Response.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[notifications/subscribe] Error:", msg);
    return Response.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return Response.json({ error: "endpoint required" }, { status: 400 });
  }

  try {
    await fetchAuthMutation(req, api.pushSubscriptions.removeSubscription, {
      endpoint: body.endpoint,
    });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unauthenticated") || msg.includes("Unauthorized")) {
      return Response.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[notifications/subscribe] Delete error:", msg);
    return Response.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
