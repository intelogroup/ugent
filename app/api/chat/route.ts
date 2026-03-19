import { openai } from '@ai-sdk/openai';
import { streamText, StreamData } from 'ai';
import { getContext, getImages } from '@/lib/pinecone';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Model routing based on retrieval confidence.
 *
 * Eval findings (scripts/eval-search.ts):
 *   GPT-5.4 — best when context is strong (IN_CONTEXT avg 35.8/40): uses chunks precisely
 *   GPT-5.2 — best when context is weak/absent (PARTIAL 30.0, OUT_OF_SCOPE 20.0):
 *             better source-awareness, less likely to hallucinate beyond context
 *
 * Threshold 0.60 derived from eval-rag.ts score distribution:
 *   Strong context (structural/direct queries): 0.68–0.83
 *   Weak context (partial/OOS):                 0.30–0.58
 */
const STRONG_CONTEXT_THRESHOLD = 0.60;

function selectModel(topScore: number) {
  if (topScore >= STRONG_CONTEXT_THRESHOLD) {
    return { model: openai('gpt-5.4'), reason: 'strong-context' };
  }
  return { model: openai('gpt-5.2'), reason: 'weak-context' };
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const lastMessage = messages[messages.length - 1];
    const userQuery = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : (lastMessage.content as any[]).map((p: any) => p.text ?? '').join(' ');

    // Fetch context and images in parallel
    const [context, imageResults] = await Promise.all([
      getContext(userQuery, undefined, true),
      getImages(userQuery, 2),
    ]);
    const topScore = (context[0] as any)?.score ?? 0;
    const contextFound = context.length > 0;

    const { model, reason } = selectModel(topScore);

    // Strip scores before injecting into the prompt
    const cleanContext = context.map(({ score, ...chunk }) => chunk);

    const data = new StreamData();
    // appendMessageAnnotation attaches data to this specific message (readable via message.annotations)
    data.appendMessageAnnotation({
      context_found: contextFound,
      model_used: reason,
      top_score: topScore,
      images: imageResults.map(img => img.image_id),
    });

    const contextString = contextFound
      ? cleanContext
          .map((chunk) => `[Source: ${chunk.book} - ${chunk.chapter}]\n${chunk.text}`)
          .join('\n\n')
      : 'No context found for this query in the provided textbooks.';

    const systemPrompt = `You are a helpful medical assistant. You are helping a student study for the USMLE Step 1.
You MUST prioritize the following textbook context to answer the student's question.

Textbook Context:
${contextString}

Instructions:
1. ALWAYS use the provided context first.
2. If context is provided, use it as the definitive source.
3. If the context is marked as "No context found", you can use your general knowledge but you MUST inform the user that this answer is based on general AI knowledge and not the specific textbooks (First Aid/Pathoma).
4. Be concise and professional.`;

    const result = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      onFinish() {
        data.close();
      },
    });

    return result.toDataStreamResponse({ data });
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
