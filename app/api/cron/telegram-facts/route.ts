import { generateFacts } from '@/lib/facts-agent';
import { sendTelegramFactsToAll } from '@/lib/telegram';

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const facts = await generateFacts();

  sendTelegramFactsToAll(facts).catch((err) =>
    console.error('[cron/telegram-facts] Telegram send failed:', err)
  );

  return Response.json({
    ok: true,
    factCount: facts.length,
    sentAt: new Date().toISOString(),
  });
}
