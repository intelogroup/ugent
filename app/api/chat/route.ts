import { openai } from '@ai-sdk/openai';
import { streamText, StreamData } from 'ai';
import { getContext } from '@/lib/pinecone';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // Get the last user message to retrieve context
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage.content;

    // Retrieve context from Pinecone
    const context = await getContext(userQuery);
    const contextFound = context.length > 0;

    // Create a StreamData object to send metadata
    const data = new StreamData();
    data.append({ context_found: contextFound });
    
    // Construct the context string and collect image IDs
    const contextString = contextFound 
      ? context
          .map((chunk) => {
            const imageInfo = chunk.image_ids && chunk.image_ids.length > 0 
              ? ` (Available images: ${chunk.image_ids.join(', ')})` 
              : '';
            return `[Source: ${chunk.book} - ${chunk.chapter}]\n${chunk.text}${imageInfo}`;
          })
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
4. If you mention a concept or a disease that has an associated image ID mentioned in the context, you MUST include the image ID in your response using the format [Image: ID].
5. Be concise and professional.`;

    const result = streamText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      onFinish() {
        data.close();
      }
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
