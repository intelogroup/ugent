import { generateFacts } from '@/lib/facts-agent';
import { sendTelegramFactsToAll } from '@/lib/telegram';

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const facts = await generateFacts();
  console.log(`[cron/telegram-facts] Generated ${facts.length} facts, sending to Telegram...`);

  let telegramError: string | null = null;
  try {
    await sendTelegramFactsToAll(facts);
    console.log('[cron/telegram-facts] Telegram send complete');
  } catch (err) {
    telegramError = err instanceof Error ? err.message : String(err);
    console.error('[cron/telegram-facts] Telegram send failed:', telegramError);
  }

  return Response.json({
    ok: telegramError === null,
    factCount: facts.length,
    sentAt: new Date().toISOString(),
    ...(telegramError ? { error: telegramError } : {}),
  });
}
