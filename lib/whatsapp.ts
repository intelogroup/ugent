import type { Fact } from './facts-agent';

const API_URL = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

function buildFactsText(facts: Fact[]): string {
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

export async function sendWhatsAppFacts(
  facts: Fact[],
  to: string
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    console.warn('[whatsapp] WHATSAPP_TOKEN not set — skipping');
    return;
  }

  const body = buildFactsText(facts);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`[whatsapp] API error: ${JSON.stringify(err)}`);
  }

  console.log(`[whatsapp] Sent ${facts.length} facts to ${to}`);
}

export async function sendWhatsAppFactsToAll(facts: Fact[]): Promise<void> {
  const recipients = (process.env.WHATSAPP_RECIPIENTS ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.warn('[whatsapp] WHATSAPP_RECIPIENTS not set — skipping');
    return;
  }

  await Promise.allSettled(
    recipients.map((to) =>
      sendWhatsAppFacts(facts, to).catch((err) =>
        console.error(`[whatsapp] Failed to send to ${to}:`, err)
      )
    )
  );
}
