import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './openai';

let pc: Pinecone | null = null;

function getPineconeClient() {
  if (!pc) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not defined');
    }
    pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pc;
}

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
 * @param namespaces The Pinecone namespaces to search in (default: ['first-aid-2023', 'pathoma-2021']).
 * @returns An array of metadata for the matching chunks, sorted by score.
 */
export async function getContext(query: string, namespaces: string[] = ['first-aid-2023', 'pathoma-2021']): Promise<ChunkMetadata[]> {
  try {
    const client = getPineconeClient();
    // 1. Vectorize the user's query
    const queryEmbedding = await getEmbedding(query);

    // 2. Query the Pinecone index for each namespace in parallel
    const index = client.index(indexName);
    
    const queryPromises = namespaces.map(async (ns) => {
      const response = await index.namespace(ns).query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
      });
      return response.matches.map(match => ({
        ...match.metadata as ChunkMetadata,
        score: match.score || 0
      }));
    });

    const results = await Promise.all(queryPromises);

    // 3. Flatten, sort by score, and take top 7 total
    return results
      .flat()
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, 7)
      .map(({ score, ...metadata }) => metadata as ChunkMetadata);
  } catch (error) {
    console.error('Error retrieving context from Pinecone:', error);
    return []; // Return empty array instead of throwing to prevent crashing the chat
  }
}
