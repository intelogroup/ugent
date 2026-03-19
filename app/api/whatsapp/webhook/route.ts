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
  const body = await req.json();

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (message) {
    const from: string = message.from; // international format, no +
    const text: string = message?.text?.body ?? '';
    console.log(`[whatsapp] Message from ${from}: "${text}"`);
    console.log(
      `[whatsapp] To subscribe this number, add ${from} to WHATSAPP_RECIPIENTS env var`
    );
  }

  // Always return 200 — Meta retries on non-200
  return new Response('OK', { status: 200 });
}
