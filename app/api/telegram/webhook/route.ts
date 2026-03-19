/**
 * Telegram webhook — receives messages and replies using the RAG pipeline.
 *
 * Setup:
 *   1. Create a bot via @BotFather → get TELEGRAM_BOT_TOKEN
 *   2. Choose a secret (any random string) → set as TELEGRAM_WEBHOOK_SECRET
 *   3. Register the webhook (once, after deploy):
 *      curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook&secret_token=<SECRET>"
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getContext } from '@/lib/pinecone';
import { sendTelegramMessage } from '@/lib/telegram';

const STRONG_CONTEXT_THRESHOLD = 0.60;

function selectModel(topScore: number) {
  if (topScore >= STRONG_CONTEXT_THRESHOLD) {
    return { model: openai('gpt-5.4'), reason: 'strong-context' };
  }
  return { model: openai('gpt-5.2'), reason: 'weak-context' };
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
  const userQuery: string = message.text;

  try {
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
        { role: 'user', content: userQuery },
      ],
    });

    await sendTelegramMessage(chatId, text);
  } catch (error) {
    console.error('[telegram] Error:', error);
    await sendTelegramMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }

  // Always return 200 — Telegram retries on non-200
  return new Response('OK', { status: 200 });
}
