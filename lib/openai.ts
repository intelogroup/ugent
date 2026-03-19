import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not defined');
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * Generates an embedding for a given text using the text-embedding-3-large model.
 * 
 * @param text The text to vectorize.
 * @returns The embedding as an array of numbers.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text.replace(/\n/g, ' '),
      dimensions: 1024,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
