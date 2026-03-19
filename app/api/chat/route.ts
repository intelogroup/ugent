import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
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
    
    // Construct the context string and collect image IDs
    const contextString = context
      .map((chunk) => {
        const imageInfo = chunk.image_ids && chunk.image_ids.length > 0 
          ? ` (Available images: ${chunk.image_ids.join(', ')})` 
          : '';
        return `[Source: ${chunk.book} - ${chunk.chapter}]\n${chunk.text}${imageInfo}`;
      })
      .join('\n\n');

    const systemPrompt = `You are a helpful medical assistant. You are helping a student study for the USMLE Step 1.
Use the following textbook context to answer the student's question. 

Textbook Context:
${contextString}

Instructions:
1. Base your answer primarily on the provided textbook context.
2. If the context is not sufficient, you can use your general knowledge but prioritize the provided information.
3. If you mention a concept or a disease that has an associated image ID mentioned in the context, you MUST include the image ID in your response using the format [Image: ID].
4. Be concise and professional.`;

    const result = streamText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
