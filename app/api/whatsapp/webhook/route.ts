/**
 * WhatsApp webhook — handles verification + full RAG pipeline.
 * Mirrors the Telegram webhook (app/api/telegram/webhook/route.ts).
 *
 * Setup:
 *   1. Create a Meta app → WhatsApp product → get WHATSAPP_TOKEN
 *   2. Set WHATSAPP_VERIFY_TOKEN to any secret string (e.g. "ugent_whatsapp_verify")
 *   3. Set WHATSAPP_APP_SECRET from App Settings → Basic → App Secret
 *   4. Register webhook in Meta dashboard:
 *      - Callback URL: https://<your-domain>/api/whatsapp/webhook
 *      - Verify Token: <your WHATSAPP_VERIFY_TOKEN value>
 *      - Subscribe to "messages" field
 *   5. Set WHATSAPP_PHONE_NUMBER_ID from the phone number in Meta dashboard
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ConvexHttpClient } from 'convex/browser';
import { getContext } from '@/lib/pinecone';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { api } from '@/convex/_generated/api';

const STRONG_CONTEXT_THRESHOLD = 0.60;

function selectModel(topScore: number) {
  if (topScore >= STRONG_CONTEXT_THRESHOLD) {
    return { model: openai('gpt-5.4') };
  }
  return { model: openai('gpt-5.2') };
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

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
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const rawBody = await req.text();
  const expected =
    'sha256=' +
    createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
      .update(rawBody)
      .digest('hex');

  let signatureBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    signatureBuf = Buffer.from(signature);
    expectedBuf = Buffer.from(expected);
  } catch {
    return NextResponse.json({ error: 'Invalid signature format' }, { status: 401 });
  }

  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('OK', { status: 200 });
  }

  const entry = (body as any)?.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  // Ignore non-message events (status updates, etc.)
  if (!message || message.type !== 'text') {
    return new Response('OK', { status: 200 });
  }

  const from: string = message.from; // E.164 without +, e.g. "18574261739"
  const userQuery: string = message.text?.body ?? '';

  if (!userQuery) {
    return new Response('OK', { status: 200 });
  }

  const webhookSecret = process.env.WHATSAPP_VERIFY_TOKEN!;

  // Handle "connect <token>" for bot onboarding (links WhatsApp phone to web account)
  const connectMatch = userQuery.trim().match(/^connect\s+(\d{6})$/i);
  if (connectMatch) {
    const token = connectMatch[1];
    try {
      const convex = getConvexClient();
      if (convex) {
        const result = await convex.mutation(api.botOnboarding.consumeWhatsappToken, {
          token,
          phone: from,
          webhookSecret,
        });
        const replies: Record<string, string> = {
          ok: '✅ Your WhatsApp is now connected! You can chat here and your conversations will sync.',
          invalid: '❌ Invalid token. Please generate a new one from the web app.',
          expired: '⏰ Token expired. Please generate a new one from the web app.',
          used: '⚠️ Token already used. You may already be connected.',
        };
        await sendWhatsAppMessage(from, replies[result.status] ?? '❌ Something went wrong.');
      } else {
        await sendWhatsAppMessage(from, 'Welcome to UGent! Ask me any USMLE Step 1 question.');
      }
    } catch (error) {
      console.error('[whatsapp] connect error:', error);
      try {
        await sendWhatsAppMessage(from, 'Welcome to UGent! Ask me any USMLE Step 1 question.');
      } catch (sendErr) {
        console.error('[whatsapp] fallback send error:', sendErr);
      }
    }
    return new Response('OK', { status: 200 });
  }

  try {
    const convex = getConvexClient();

    let threadId: string | null = null;
    let priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (convex) {
      threadId = await convex.mutation(api.threads.getOrCreateWhatsappThread, {
        phone: from,
        webhookSecret,
      });

      const recent = await convex.query(api.messages.getRecentBotMessages, {
        threadId: threadId as any,
        limit: 12,
        webhookSecret,
      });
      priorMessages = recent.map((m: any) => ({ role: m.role, content: m.content }));
    }

    const context = await getContext(userQuery, undefined, true, true);
    const topScore = (context[0] as any)?.score ?? 0;
    const contextFound = context.length > 0;

    const { model } = selectModel(topScore);
    const cleanContext = context.map(({ score, ...chunk }: any) => chunk);

    const contextString = contextFound
      ? cleanContext
          .map((chunk: any) => `[Source: ${chunk.book} - ${chunk.chapter}]\n${chunk.text}`)
          .join('\n\n')
      : 'No context found for this query in the provided textbooks.';

    const systemPrompt = `You are a helpful medical assistant helping a student study for the USMLE Step 1.
You MUST prioritize the following textbook context to answer the question.

Textbook Context:
${contextString}

Instructions:
1. ALWAYS use the provided context first.
2. If context is provided, use it as the definitive source.
3. If the context is marked as "No context found", use general knowledge but INFORM the user the answer is based on general AI knowledge, not the specific textbooks (First Aid/Pathoma).
4. Be concise and professional.
5. Keep responses under 4000 characters.`;

    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorMessages,
        { role: 'user', content: userQuery },
      ],
    });

    if (convex && threadId) {
      await convex.mutation(api.messages.addBotMessage, {
        threadId: threadId as any,
        role: 'user',
        content: userQuery,
        webhookSecret,
      });
      await convex.mutation(api.messages.addBotMessage, {
        threadId: threadId as any,
        role: 'assistant',
        content: text,
        webhookSecret,
      });
    }

    await sendWhatsAppMessage(from, text);
  } catch (error) {
    console.error('[whatsapp] Error:', error);
    await sendWhatsAppMessage(from, 'Sorry, something went wrong. Please try again.');
  }

  return new Response('OK', { status: 200 });
}
