import dotenv from 'dotenv';
import { getContext } from '../lib/pinecone';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

dotenv.config({ path: '.env.production' });

async function main() {
  const query = 'What is Heparin?';
  console.log('Testing query:', query);

  try {
    console.log('Retrieving context...');
    const context = await getContext(query);
    console.log('Context retrieved count:', context.length);
    if (context.length > 0) {
      console.log('First chunk:', context[0].text.substring(0, 100) + '...');
    }

    console.log('Generating AI response...');
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: `Context: ${JSON.stringify(context)}\n\nQuery: ${query}`,
    });

    console.log('AI Response:', text);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
