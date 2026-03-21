import OpenAI from 'openai';
import { tavily } from '@tavily/core';
import { getContext } from './pinecone';

export interface Fact {
  id: string;
  topic: string;
  fact: string;
  source: string;
  category: string;
  generatedAt: string;
}

// High-yield USMLE Step 1 topic pool — agent picks 3 at random each cycle
const USMLE_TOPICS = [
  'myocardial infarction pathophysiology',
  'diabetes mellitus type 1 vs type 2',
  'nephrotic syndrome vs nephritic syndrome',
  'lung cancer histology and presentation',
  'hepatitis B serology interpretation',
  'streptococcal pharyngitis complications',
  'hypothyroidism signs and labs',
  'Cushing syndrome vs Addison disease',
  'meningitis CSF findings',
  'leukemia classification and markers',
  'SLE diagnostic criteria',
  'inflammatory bowel disease comparison',
  'HIV opportunistic infections by CD4 count',
  'coagulation cascade and bleeding disorders',
  'pneumonia causative organisms by patient type',
  'renal tubular acidosis types',
  'heart murmur auscultation and causes',
  'Alzheimer disease pathology',
  'thyroid nodule evaluation',
  'antibiotic mechanisms and resistance',
  'breast cancer receptor status and treatment',
  'stroke syndromes and vascular territories',
  'septic shock hemodynamics',
  'acid-base disorders interpretation',
  'GI bleeding upper vs lower causes',
];

// Tavily search queries to surface real community intelligence
const WEB_SEARCH_QUERIES = [
  'USMLE Step 1 high yield topics Reddit 2025',
  'USMLE Step 1 exam questions students sharing forums',
  'ECFMG news updates 2025',
  'USMLE Step 1 study strategies Reddit premed',
  'USMLE Step 1 most tested topics anki reddit',
];

function pickRandomTopics(n: number): string[] {
  const shuffled = [...USMLE_TOPICS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _factsOpenAI: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_factsOpenAI) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not defined');
    _factsOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _factsOpenAI;
}

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  return tavily({ apiKey });
}

/**
 * Searches the web (Reddit, forums, ECFMG announcements, etc.) via Tavily
 * to surface what students are actually discussing right now.
 */
async function searchWebForContext(): Promise<string> {
  const client = getTavilyClient();
  if (!client) return '';

  try {
    const query = pickRandom(WEB_SEARCH_QUERIES);
    const response = await client.search(query, {
      maxResults: 5,
      searchDepth: 'advanced',
      includeAnswer: true,
      includeDomains: [
        'reddit.com',
        'usmle.org',
        'ecfmg.org',
        'studentdoctor.net',
        'amboss.com',
        'boards.ie',
        'usmlerx.com',
      ],
    });

    const snippets = response.results
      .map((r) => `[${r.title}]\n${r.content?.slice(0, 400) ?? ''}`)
      .join('\n\n');

    const answer = (response as any).answer ? `Summary: ${(response as any).answer}\n\n` : '';
    return `--- Community Intelligence (${query}) ---\n${answer}${snippets}`;
  } catch {
    return '';
  }
}

/**
 * Research agent: queries Pinecone across multiple topics AND searches the web
 * for community discussions, then synthesizes high-yield USMLE Step 1 facts.
 */
export async function generateFacts(): Promise<Fact[]> {
  const topics = pickRandomTopics(3);

  // Run Pinecone + web search in parallel — gracefully degrade on failure
  let contextResults: Awaited<ReturnType<typeof getContext>>[];
  let webContext: string;
  try {
    [contextResults, webContext] = await Promise.all([
      Promise.all(
        topics.map((topic) => getContext(topic, ['first-aid-2023', 'pathoma-2021']))
      ),
      searchWebForContext(),
    ]);
  } catch (error) {
    console.error('[facts-agent] Context retrieval failed, using fallbacks:', error);
    return getFallbackFacts();
  }

  // Build textbook context block
  const textbookBlock = contextResults
    .flatMap((chunks, i) =>
      chunks.map(
        (chunk) =>
          `[Topic: ${topics[i]}]\n[Source: ${chunk.book} — ${chunk.chapter}]\n${chunk.text}`
      )
    )
    .join('\n\n---\n\n');

  if (!textbookBlock.trim() && !webContext) {
    return getFallbackFacts();
  }

  const openai = getOpenAIClient();

  const contextSection = [
    textbookBlock ? `=== TEXTBOOK KNOWLEDGE BASE ===\n${textbookBlock}` : '',
    webContext ? `=== STUDENT COMMUNITY INTELLIGENCE ===\n${webContext}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a senior USMLE Step 1 tutor. You have access to:
1. Authoritative textbook excerpts (First Aid, Pathoma)
2. Real-time student community intelligence (Reddit, forums, ECFMG news)

Your job is to generate 5 high-yield study facts that are:
- Currently relevant to what students are discussing and testing
- Derived from the textbook knowledge base for accuracy
- Informed by community intelligence for what's trending/being asked

Rules:
- Generate exactly 5 distinct, exam-relevant facts
- Prioritize: classic presentations, associations, mnemonics, distinguishing features
- If community intelligence reveals a hot topic or common confusion, address it
- Return JSON: { "facts": [ { "topic": string, "fact": string, "source": string, "category": string } ] }
- "source" references the book/chapter or "Community Insight — [platform]"
- "category" must be one of: Cardiology, Pulmonology, Nephrology, GI, Endocrinology, Hematology, Infectious Disease, Neurology, Oncology, Immunology, Pharmacology, Pathology`,
      },
      {
        role: 'user',
        content: `Generate 5 high-yield USMLE Step 1 facts using the following context:\n\n${contextSection}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return getFallbackFacts();

  try {
    const parsed = JSON.parse(content) as {
      facts: Array<{ topic: string; fact: string; source: string; category: string }>;
    };

    const generatedAt = new Date().toISOString();
    return parsed.facts.slice(0, 5).map((f, i) => ({
      id: `fact-${Date.now()}-${i}`,
      topic: f.topic,
      fact: f.fact,
      source: f.source,
      category: f.category,
      generatedAt,
    }));
  } catch {
    return getFallbackFacts();
  }
}

function getFallbackFacts(): Fact[] {
  const generatedAt = new Date().toISOString();
  return [
    {
      id: `fallback-${Date.now()}-0`,
      topic: 'Myocardial Infarction',
      fact: 'ST-elevation MI (STEMI) reflects full-thickness (transmural) infarction; NSTEMI involves subendocardial injury without ST elevation.',
      source: 'First Aid — Cardiology',
      category: 'Cardiology',
      generatedAt,
    },
    {
      id: `fallback-${Date.now()}-1`,
      topic: 'Nephrotic Syndrome',
      fact: 'Classic tetrad: massive proteinuria (>3.5 g/day), hypoalbuminemia, edema, and hyperlipidemia. Minimal change disease is #1 cause in children.',
      source: 'Pathoma — Kidneys',
      category: 'Nephrology',
      generatedAt,
    },
    {
      id: `fallback-${Date.now()}-2`,
      topic: 'Meningitis',
      fact: 'Bacterial meningitis CSF: high WBC (PMNs), low glucose, high protein. Viral: lymphocytes, normal glucose.',
      source: 'First Aid — Infectious Disease',
      category: 'Infectious Disease',
      generatedAt,
    },
    {
      id: `fallback-${Date.now()}-3`,
      topic: 'Cushing Syndrome',
      fact: 'Most common cause of Cushing syndrome is exogenous glucocorticoids. Endogenous: pituitary adenoma (Cushing disease) > ectopic ACTH > adrenal adenoma.',
      source: 'First Aid — Endocrinology',
      category: 'Endocrinology',
      generatedAt,
    },
    {
      id: `fallback-${Date.now()}-4`,
      topic: 'SLE',
      fact: 'Anti-dsDNA and anti-Sm are specific for SLE. Anti-histone antibodies are classic for drug-induced lupus.',
      source: 'First Aid — Immunology',
      category: 'Immunology',
      generatedAt,
    },
  ];
}
