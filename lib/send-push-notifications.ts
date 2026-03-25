/**
 * Send the daily facts batch to all opted-in web push subscribers.
 * Called fire-and-forget from the facts cron route.
 *
 * Fetches subscriptions via the Convex HTTP API using the deploy key,
 * matching the pattern used by telegram/whatsapp senders.
 */
import type { Fact } from "@/lib/facts-agent";
import { sendWebPush } from "@/lib/web-push";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "@/convex/_generated/api";

export async function sendPushNotificationsToAll(facts: Fact[]): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@ugent.app";
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!vapidPublicKey || !vapidPrivateKey || !convexUrl) {
    // Push not configured — skip silently
    return;
  }

  const firstFact = facts[0];
  if (!firstFact) return;

  const payload = JSON.stringify({
    title: `UGent Daily Fact — ${firstFact.category}`,
    body: firstFact.fact.slice(0, 120),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: "daily-fact",
    data: { url: "/dashboard" },
  });

  let subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }> = [];

  try {
    const client = new ConvexHttpClient(convexUrl);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptions = await client.query(internal.pushSubscriptions.listAll as any, {});
  } catch (err) {
    console.error("[push] Failed to fetch subscriptions:", err);
    return;
  }

  if (subscriptions.length === 0) return;

  const vapidKeys = { publicKey: vapidPublicKey, privateKey: vapidPrivateKey };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendWebPush(sub, payload, vapidKeys, vapidSubject)
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const gone = results.filter((r) => r.status === "fulfilled" && r.value === false).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[push] Sent: ${sent}, Gone: ${gone}, Failed: ${failed}`);
}
