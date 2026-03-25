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
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: "Push notifications not configured" }, { status: 503 });
  }
  return Response.json({ publicKey });
}

export async function POST(req: Request) {
  const { user, accessToken } = await withAuth();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Invalid subscription object" }, { status: 400 });
  }

  try {
    const convexUser = await fetchQuery(api.auth.getByEmail, { email: user.email! }, { token: accessToken });
    if (!convexUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    await fetchMutation(
      api.pushSubscriptions.saveSubscription,
      { userId: convexUser._id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { token: accessToken }
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[notifications/subscribe] Error:", err);
    return Response.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, accessToken } = await withAuth();
  if (!user) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return Response.json({ error: "endpoint required" }, { status: 400 });
  }

  try {
    const convexUser = await fetchQuery(api.auth.getByEmail, { email: user.email! }, { token: accessToken });
    if (!convexUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    await fetchMutation(
      api.pushSubscriptions.removeSubscription,
      { userId: convexUser._id, endpoint: body.endpoint },
      { token: accessToken }
    );
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[notifications/subscribe] Delete error:", err);
    return Response.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
