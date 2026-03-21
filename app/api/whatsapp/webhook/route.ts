/**
 * WhatsApp webhook — handles verification + opt-in messages.
 * When a user messages the bot, their number is logged.
 * To persist subscribers, set WHATSAPP_RECIPIENTS in env vars manually
 * (comma-separated international format, e.g. "15551234567,44701234567").
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON — still return 200 so Meta doesn't retry
    return new Response('OK', { status: 200 });
  }

  const entry = (body as any)?.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (message) {
    const from: string = message.from; // international format, no +
    // Acknowledge receipt without logging PII (phone number)
    void from; // consumed but not logged
  }

  // Always return 200 — Meta retries on non-200
  return new Response('OK', { status: 200 });
}
