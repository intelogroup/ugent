import { generateFacts } from '@/lib/facts-agent';
import { sendTelegramFactsToAll } from '@/lib/telegram';

export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let facts;
  try {
    facts = await generateFacts();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/telegram-facts] Failed to generate facts:', msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }

  let telegramError: string | null = null;
  try {
    await sendTelegramFactsToAll(facts);
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
