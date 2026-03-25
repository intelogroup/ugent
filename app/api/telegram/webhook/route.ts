/**
 * Telegram webhook — receives messages and replies using the RAG pipeline.
 * Persists conversations to Convex and handles bot onboarding (/start <token>).
 *
 * Setup:
 *   1. Create a bot via @BotFather → get TELEGRAM_BOT_TOKEN
 *   2. Choose a secret (any random string) → set as TELEGRAM_WEBHOOK_SECRET
 *   3. Register the webhook (once, after deploy):
 *      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook&secret_token=<SECRET>"
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ConvexHttpClient } from 'convex/browser';
import { getContext } from '@/lib/pinecone';
import { sendTelegramMessage } from '@/lib/telegram';
import { api } from '@/convex/_generated/api';

const STRONG_CONTEXT_THRESHOLD = 0.60;

function selectModel(topScore: number) {
  if (topScore >= STRONG_CONTEXT_THRESHOLD) {
    return { model: openai('gpt-5.4'), reason: 'strong-context' };
  }
  return { model: openai('gpt-5.2'), reason: 'weak-context' };
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function POST(req: Request) {
  // Verify secret token
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = await req.json();
  const message = body?.message;

  if (!message?.text) {
    return new Response('OK', { status: 200 });
  }

  const chatId: number = message.chat.id;
  const telegramId = String(chatId);
  const userQuery: string = message.text;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET!;

  // Handle /start <token> for bot onboarding
  if (userQuery.startsWith('/start')) {
    const token = userQuery.split(' ')[1]?.trim();
    if (token && /^\d{6}$/.test(token)) {
      try {
        const convex = getConvexClient();
        if (convex) {
          const result = await convex.mutation(api.botOnboarding.consumeTelegramToken, {
            token,
            telegramId,
            telegramUsername: message.from?.username,
            webhookSecret,
          });
          const replies: Record<string, string> = {
            ok: '✅ Your Telegram account is now connected! You can chat here and your conversations will sync.',
            invalid: '❌ Invalid token. Please generate a new one from the web app.',
            expired: '⏰ Token expired. Please generate a new one from the web app.',
            used: '⚠️ Token already used. You may already be connected.',
          };
          await sendTelegramMessage(chatId, replies[result.status] ?? '❌ Something went wrong.');
        } else {
          await sendTelegramMessage(chatId, 'Welcome to UGent! Ask me any USMLE Step 1 question.');
        }
      } catch (error) {
        console.error('[telegram] /start error:', error);
        await sendTelegramMessage(chatId, 'Welcome to UGent! Ask me any USMLE Step 1 question.');
      }
      return new Response('OK', { status: 200 });
    }

    // /start with no token — generic welcome
    await sendTelegramMessage(chatId, 'Welcome to UGent! 🩺 Ask me any USMLE Step 1 question.');
    return new Response('OK', { status: 200 });
  }

  try {
    const convex = getConvexClient();

    // Get or create a Telegram thread for this chat
    let threadId: string | null = null;
    let priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (convex) {
      threadId = await convex.mutation(api.threads.getOrCreateTelegramThread, {
        telegramId,
        webhookSecret,
      });

      // Fetch recent history for context continuity (last 6 turns)
      const recent = await convex.query(api.messages.getRecentBotMessages, {
        threadId: threadId as any,
        limit: 12,
        webhookSecret,
      });
      priorMessages = recent.map((m: any) => ({ role: m.role, content: m.content }));
    }

    // RAG retrieval
    const context = await getContext(userQuery, undefined, true);
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
5. Keep responses under 4000 characters for Telegram.`;

    const { text } = await generateText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorMessages,
        { role: 'user', content: userQuery },
      ],
    });

    // Persist to Convex
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

    await sendTelegramMessage(chatId, text);
  } catch (error) {
    console.error('[telegram] Error:', error);
    await sendTelegramMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }

  // Always return 200 — Telegram retries on non-200
  return new Response('OK', { status: 200 });
}
