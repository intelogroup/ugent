import type { Fact } from './facts-agent';

export function buildFactsText(facts: Fact[]): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const lines = facts.map(
    (f, i) => `${i + 1}. *[${f.category}]* ${f.fact}\n_📖 ${f.source}_`
  );

  return `🩺 *High-Yield USMLE Facts*\n${date}\n\n${lines.join('\n\n')}\n\n_Powered by UGent MedBot_`;
}

interface TelegramSendResult {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }

  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const json: TelegramSendResult = await res.json();

  if (!res.ok) {
    console.error(`[telegram] API error for ${chatId}: HTTP ${res.status}`, json.description);
    throw new Error(`[telegram] API error ${res.status}: ${json.description ?? 'unknown'}`);
  }
}

export async function sendTelegramFacts(facts: Fact[], chatId: number | string): Promise<void> {
  const text = buildFactsText(facts);
  await sendTelegramMessage(chatId, text);
}

export async function sendTelegramFactsToAll(facts: Fact[]): Promise<void> {
  const recipients = (process.env.TELEGRAM_RECIPIENTS ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn('[telegram] TELEGRAM_RECIPIENTS not set — skipping');
    return;
  }

  await Promise.allSettled(
    recipients.map((chatId) =>
      sendTelegramFacts(facts, chatId).catch((err) =>
        console.error(`[telegram] Failed to send to ${chatId}:`, err)
      )
    )
  );
}
