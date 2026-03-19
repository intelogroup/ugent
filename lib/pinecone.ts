import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './openai';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const indexName = process.env.PINECONE_INDEX_NAME!;

/**
 * Metadata structure for chunks stored in Pinecone.
 */
export interface ChunkMetadata {
  text: string;
  book: string;
  chapter: string;
  section: string;
  subsection: string;
  image_ids: string[];
  [key: string]: any;
}

/**
 * Retrieves relevant context for a given query by searching the Pinecone vector database.
 * 
 * @param query The user's query string.
 * @param namespace The Pinecone namespace to search in (default: 'first-aid-2023').
 * @returns An array of metadata for the Top-5 matching chunks.
 */
export async function getContext(query: string, namespace: string = 'first-aid-2023'): Promise<ChunkMetadata[]> {
  try {
    // 1. Vectorize the user's query
    const queryEmbedding = await getEmbedding(query);

    // 2. Query the Pinecone index
    const index = pc.index(indexName);
    const queryResponse = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    // 3. Extract and return the metadata
    return queryResponse.matches
      .map((match) => match.metadata as ChunkMetadata)
      .filter((metadata) => !!metadata);
  } catch (error) {
    console.error('Error retrieving context from Pinecone:', error);
    throw error;
  }
}
