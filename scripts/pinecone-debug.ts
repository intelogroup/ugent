import dotenv from 'dotenv';
dotenv.config({ path: '/Users/kalinovdameus/Developer/ugent/.env' });

import { Pinecone } from '@pinecone-database/pinecone';

async function main() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pc.index(process.env.PINECONE_INDEX_NAME!);

  console.log('=== PATHOMA CHUNK FULL METADATA ===');
  const pathRes = await index.namespace('pathoma-2021').query({
    vector: new Array(1024).fill(0.01),
    topK: 3,
    includeMetadata: true,
  });
  for (const m of pathRes.matches) {
    console.log(`\nID: ${m.id}`);
    console.log('keys:', Object.keys(m.metadata ?? {}).join(', '));
    const meta = m.metadata as any;
    console.log('page_number:', meta?.page_number);
    console.log('section:', meta?.section);
    console.log('book:', meta?.book);
    console.log('chapter:', meta?.chapter);
    console.log('image_ids:', JSON.stringify(meta?.image_ids));
  }

  console.log('\n=== IMAGE RECORD FULL METADATA ===');
  const imgRes = await index.namespace('images').query({
    vector: new Array(1024).fill(0.01),
    topK: 5,
    includeMetadata: true,
  });
  for (const m of imgRes.matches) {
    console.log(`\nID: ${m.id}`);
    const meta = m.metadata as any;
    console.log('keys:', Object.keys(meta ?? {}).join(', '));
    console.log('source_book:', meta?.source_book);
    console.log('page_number:', meta?.page_number);
    console.log('caption:', meta?.caption?.substring(0, 60));
  }
}

main().catch(console.error);
