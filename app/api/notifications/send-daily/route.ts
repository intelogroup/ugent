/**
 * GET /api/notifications/send-daily
 * Cron-protected route that sends the current daily facts batch as web push
 * notifications to all opted-in subscribers.
 *
 * Protected by: Authorization: Bearer ${CRON_SECRET}
 * Called by: Vercel/external cron scheduler daily.
 */
import { generateFacts } from "@/lib/facts-agent";
import { sendPushNotificationsToAll } from "@/lib/send-push-notifications";

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const facts = await generateFacts();

    await sendPushNotificationsToAll(facts);

    return Response.json({
      ok: true,
      factCount: facts.length,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notifications/send-daily] Error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
