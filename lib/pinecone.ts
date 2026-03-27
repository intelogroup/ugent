import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbedding } from './openai';

// ─── Chapter maps ─────────────────────────────────────────────────────────────
// Maps ordinal/cardinal chapter numbers → exact chapter title substring used in embeddings.
// Keeps structural queries ("chapter 1", "first chapter") resolvable via semantic search.

const PATHOMA_CHAPTERS: Record<number, string> = {
  1:  'Growth Adaptations, Cellular Injury, and Cell Death',
  2:  'Inflammation, Inflammatory Disorders, and Wound Healing',
  3:  'Principles of Neoplasia',
  4:  'Hemostasis and Related Disorders',
  5:  'Red Blood Cell Disorders',
  6:  'White Blood Cell Disorders',
  7:  'Vascular Pathology',
  8:  'Cardiac Pathology',
  9:  'Respiratory Tract Pathology',
  10: 'Gastrointestinal Pathology',
  11: 'Exocrine Pancreas, Gallbladder, and Liver Pathology',
  12: 'Kidney and Urinary Tract Pathology',
  13: 'Female Genital System and Gestational Pathology',
  14: 'Male Genital System Pathology',
  15: 'Endocrine Pathology',
  16: 'Breast Pathology',
  17: 'Central Nervous System Pathology',
  18: 'Musculoskeletal Pathology',
  19: 'Skin Pathology',
};

const FIRST_AID_CHAPTERS: Record<number, string> = {
  1:  'Section I Guide',
  2:  'Biochemistry',
  3:  'Immunology',
  4:  'Microbiology',
  5:  'Pathology',
  6:  'Pharmacology',
  7:  'Public Health Sciences',
  8:  'Cardiovascular',
  9:  'Endocrine',
  10: 'Gastrointestinal',
  11: 'Hematology and Oncology',
  12: 'Musculoskeletal',
  13: 'Neurology',
  14: 'Psychiatry',
  15: 'Renal',
  16: 'Reproductive',
  17: 'Respiratory',
};

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
};

/**
 * Detects chapter references in a query and appends the full chapter title
 * so vector search can match on content rather than structural terms.
 *
 * Examples:
 *   "chapter 1 of pathoma"    → appends "Growth Adaptations, Cellular Injury, and Cell Death"
 *   "first chapter pathoma"   → same
 *   "pathoma chapter 3"       → appends "Principles of Neoplasia"
 *   "first aid chapter 8"     → appends "Cardiovascular"
 */
export function expandChapterQuery(query: string): string {
  const lower = query.toLowerCase();

  // Determine which book is referenced (default to Pathoma if neither or both mentioned)
  const mentionsFirstAid = /first\s+aid/.test(lower);
  const mentionsPathoma = /pathoma/.test(lower);
  const chapterMap = mentionsFirstAid && !mentionsPathoma
    ? FIRST_AID_CHAPTERS
    : PATHOMA_CHAPTERS;

  // Match "chapter <number>" or "<ordinal> chapter"
  const numericMatch = lower.match(/chapter\s+(\d+)/);
  const ordinalMatch = lower.match(
    new RegExp(`(${Object.keys(ORDINALS).join('|')})\\s+chapter`)
  );

  const chapterNum = numericMatch
    ? parseInt(numericMatch[1], 10)
    : ordinalMatch
      ? ORDINALS[ordinalMatch[1]]
      : null;

  if (chapterNum && chapterMap[chapterNum]) {
    return `${query} ${chapterMap[chapterNum]}`;
  }

  // Clinical synonym expansion — maps common clinical terms to the mechanism/
  // descriptor language used in the textbook embeddings, boosting recall for
  // conditions whose section titles don't match the query term directly.
  const CLINICAL_EXPANSIONS: Array<[RegExp, string]> = [
    [/hereditary angioedema/i, 'C1 inhibitor complement deficiency bradykinin edema swelling'],
    [/\bhae\b/i,               'hereditary angioedema C1 inhibitor complement deficiency'],
    [/nephrotic syndrome/i,    'proteinuria hypoalbuminemia edema glomerular filtration barrier'],
    [/nephritic syndrome/i,    'hematuria hypertension azotemia GFR glomerulonephritis'],
    [/goodpasture/i,           'anti-GBM antibody type II hypersensitivity pulmonary renal syndrome'],
    [/sle lupus nephritis/i,   'immune complex deposition complement anti-dsDNA glomerular'],
    [/minimal change disease/i,'podocyte foot process fusion nephrotic proteinuria children'],
    [/berry aneurysm/i,        'saccular aneurysm subarachnoid hemorrhage circle of Willis'],
    [/prinzmetal/i,            'vasospasm coronary artery angina variant'],
  ];

  for (const [pattern, expansion] of CLINICAL_EXPANSIONS) {
    if (pattern.test(lower)) {
      return `${query} ${expansion}`;
    }
  }

  return query;
}

// ─── HyDE — Hypothetical Document Embeddings ──────────────────────────────────
// Instead of embedding the raw user query, ask a small/fast LLM to write a
// short hypothetical Pathoma/First Aid passage that *would* answer the query,
// then embed that passage. Because the hypothetical uses textbook vocabulary
// it sits much closer in vector space to real chunks → higher cosine scores.
//
// Model: gpt-4o-mini — cheap (<$0.001 per call) and fast (~200ms).
// Falls back to raw query if the HyDE call fails so retrieval is never blocked.

const HYDE_SYSTEM = `You are a medical textbook author writing in the style of Pathoma and First Aid for the USMLE Step 1.
Given a medical question or topic, write a focused 80-120 word textbook passage that directly covers the key facts, mechanisms, and clinical features.
Use precise medical terminology. Do not include headers. Output only the passage text.`;

let _hydeClient: import('openai').default | null = null;

async function generateHypotheticalDocument(query: string): Promise<string> {
  try {
    if (!_hydeClient) {
      const OpenAI = (await import('openai')).default;
      _hydeClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    const resp = await _hydeClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: HYDE_SYSTEM },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 160,
    });
    return resp.choices[0]?.message?.content?.trim() ?? query;
  } catch {
    return query; // graceful fallback to raw query
  }
}

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
  /** Cosine similarity score (0–1). Present when returnScores=true. */
  score?: number;
  [key: string]: any;
}

// Docs: scores below this threshold are typically noise for cosine similarity RAG.
// See: https://docs.pinecone.io/guides/data/query-data
const MIN_SCORE_THRESHOLD = 0.3;
const MIN_IMAGE_SCORE_THRESHOLD = 0.35;

export interface ImageResult {
  image_id: string;
  filename: string;
  source_book: string;
  page_number: number;
  caption: string;
  score?: number;
}

/**
 * Retrieves relevant images for a given query by searching the Pinecone `images` namespace.
 * Images are embedded by their caption/description (see embed_images.py).
 */
export async function getImages(
  query: string,
  topK = 2,
): Promise<ImageResult[]> {
  try {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) throw new Error('PINECONE_INDEX_NAME is not defined');

    const queryEmbedding = await getEmbedding(query);
    const response = await client.index(indexName).namespace('images').query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return response.matches
      .filter(m => (m.score ?? 0) >= MIN_IMAGE_SCORE_THRESHOLD)
      .map(m => ({
        ...(m.metadata as unknown as ImageResult),
        score: m.score,
      }));
  } catch (error) {
    console.error('Error retrieving images from Pinecone:', error);
    return [];
  }
}

/**
 * Retrieves relevant context for a given query by searching the Pinecone vector database.
 *
 * @param query      The user's query string.
 * @param namespaces Pinecone namespaces to search (default: both books).
 * @param returnScores  When true, includes `score` field on each result (for evals/debugging).
 */
export async function getContext(
  query: string,
  namespaces: string[] = ['first-aid-2023', 'pathoma-2021'],
  returnScores = false,
  useHyDE = false,
): Promise<ChunkMetadata[]> {
  try {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not defined');
    }

    // 1. Expand structural queries ("chapter 1") to include the actual chapter title
    const expandedQuery = expandChapterQuery(query);

    // 2. Optionally apply HyDE: generate a hypothetical textbook passage and
    //    embed that instead of the raw query. Falls back to expandedQuery on error.
    const queryToEmbed = useHyDE
      ? await generateHypotheticalDocument(expandedQuery)
      : expandedQuery;

    // 3. Vectorize
    const queryEmbedding = await getEmbedding(queryToEmbed);

    // 4. Query each namespace in parallel — fetch topK=10 per namespace so the
    //    score-threshold filter + global top-7 slice have enough candidates.
    const index = client.index(indexName);

    const queryPromises = namespaces.map(async (ns) => {
      const response = await index.namespace(ns).query({
        vector: queryEmbedding,
        topK: 10,
        includeMetadata: true,
      });
      return response.matches.map(match => ({
        ...(match.metadata as ChunkMetadata),
        score: match.score ?? 0,
      }));
    });

    const results = await Promise.all(queryPromises);

    // 5. Flatten, apply score threshold (client-side per docs), sort, take top 7
    const filtered = results
      .flat()
      .filter(r => r.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);

    if (returnScores) {
      return filtered;
    }

    // Strip scores from production responses to keep the API surface clean
    return filtered.map(({ score, ...metadata }) => metadata as ChunkMetadata);
  } catch (error) {
    console.error('Error retrieving context from Pinecone:', error);
    return [];
  }
}
