/**
 * Image-Text Association Eval: GPT-5.4 vs GPT-5.2 vs GPT-4o
 *
 * Tests two things in tandem:
 *
 *   1. RETRIEVAL ALIGNMENT — do getImages() results topically match getContext() results?
 *      Scored by an LLM judge on two dimensions:
 *        caption_relevance  — does the top image caption match the query intent?
 *        image_text_cohesion — do the image captions align with the retrieved text chunks?
 *
 *   2. MODEL ASSOCIATION ACCURACY — given a text chunk + shuffled captions
 *      (correct + distractors from other queries), can each model pick the right caption?
 *      Scored 0 or 1 per model per question.
 *
 *   3. CROSS-REFERENCE HIT — do any retrieved image IDs appear in chunk.image_ids?
 *      A structural check: verifies the embedding pipeline linked images to text correctly.
 *
 * Run: npx tsx scripts/eval-image-text.ts
 */

import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getContext, getImagesHybrid, ChunkMetadata, ImageResult } from '../lib/pinecone';

dotenv.config({ path: process.env.ENV_FILE ?? '.env.production' });

// ─── Test cases ───────────────────────────────────────────────────────────────

interface ImageTextTestCase {
  id: string;
  query: string;
  /** Keywords that must appear in a correct image caption (lowercase, partial match) */
  captionKeywords?: string[];
  /** Expected book for text context */
  expectedBook?: string;
}

const TEST_CASES: ImageTextTestCase[] = [
  {
    id: 'IT-01',
    query: 'What are the morphologic changes of coagulative necrosis?',
    captionKeywords: ['necrosis', 'coagulat', 'cell'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-02',
    query: 'Describe the Reed-Sternberg cell in Hodgkin lymphoma',
    captionKeywords: ['reed', 'sternberg', 'lymphoma', 'owl'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-03',
    query: 'What is minimal change disease and podocyte effacement?',
    captionKeywords: ['podocyte', 'glomerul', 'minimal change', 'effacement'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-04',
    query: 'Explain the zones of myocardial infarction and coagulative necrosis timeline',
    captionKeywords: ['infarct', 'myocard', 'cardiac', 'heart'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-05',
    query: 'What are the hallmarks of malignant neoplasia and tumor invasion?',
    captionKeywords: ['tumor', 'neoplasia', 'cancer', 'malign'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-06',
    query: 'Describe the coagulation cascade and platelet plug formation',
    captionKeywords: ['platelet', 'coagulat', 'thrombus', 'hemostasis'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-07',
    query: 'What is apoptosis and how does it differ from necrosis histologically?',
    captionKeywords: ['apoptosis', 'cell death', 'necrosis', 'fragment'],
    expectedBook: 'Pathoma',
  },
  {
    id: 'IT-08',
    query: 'Describe glomerulonephritis with crescent formation',
    captionKeywords: ['glomerul', 'crescent', 'nephrit', 'kidney'],
    expectedBook: 'Pathoma',
  },
];

// ─── Models ───────────────────────────────────────────────────────────────────

const MODELS = [
  { key: 'gpt54', label: 'GPT-5.4', model: openai('gpt-5.4') },
  { key: 'gpt52', label: 'GPT-5.2', model: openai('gpt-5.2') },
  { key: 'gpt4o', label: 'GPT-4o',  model: openai('gpt-4o') },
] as const;

type ModelKey = typeof MODELS[number]['key'];

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/** Check if any caption keyword appears in the image caption (case-insensitive). */
function captionKeywordHit(caption: string, keywords: string[]): boolean {
  const lower = caption.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Check structural cross-reference: do any retrieved image IDs appear in chunk.image_ids?
 * Returns the number of cross-reference hits.
 */
function crossRefHits(chunks: ChunkMetadata[], images: ImageResult[]): number {
  const retrievedImageIds = new Set(images.map(img => img.image_id));
  let hits = 0;
  for (const chunk of chunks) {
    for (const id of (chunk.image_ids ?? [])) {
      if (retrievedImageIds.has(id)) hits++;
    }
  }
  return hits;
}

// ─── LLM judge: retrieval alignment ──────────────────────────────────────────

interface AlignmentScore {
  caption_relevance: number;
  image_text_cohesion: number;
  total: number;
  rationale: string;
}

async function judgeAlignment(
  query: string,
  chunks: ChunkMetadata[],
  images: ImageResult[],
): Promise<AlignmentScore> {
  if (images.length === 0) {
    return { caption_relevance: 0, image_text_cohesion: 0, total: 0, rationale: 'No images retrieved' };
  }

  const textSummary = chunks.slice(0, 3).map(c => `[${c.book} — ${c.chapter}]: ${c.text.substring(0, 200)}`).join('\n');
  const captionSummary = images.map(img => `• "${img.caption}" (${img.source_book}, p${img.page_number})`).join('\n');

  const { text } = await generateText({
    model: openai('gpt-5.4'),
    prompt: `You are evaluating whether retrieved medical images align with retrieved text context for a student query.

QUERY: ${query}

RETRIEVED TEXT CHUNKS:
${textSummary || 'None'}

RETRIEVED IMAGE CAPTIONS:
${captionSummary}

Score on 2 dimensions (0–10 each):
- caption_relevance: Do the image captions directly relate to the query topic? (0 = completely off-topic, 10 = perfectly match query)
- image_text_cohesion: Do the image captions topically align with the retrieved text chunks? Would these images logically illustrate the text? (0 = unrelated, 10 = images perfectly illustrate the text content)

Respond ONLY with valid JSON:
{"caption_relevance": <int>, "image_text_cohesion": <int>, "rationale": "<one sentence>"}`,
  });

  try {
    const p = JSON.parse(text.trim());
    return {
      caption_relevance: p.caption_relevance,
      image_text_cohesion: p.image_text_cohesion,
      total: p.caption_relevance + p.image_text_cohesion,
      rationale: p.rationale,
    };
  } catch {
    return { caption_relevance: 0, image_text_cohesion: 0, total: 0, rationale: 'Parse error' };
  }
}

// ─── Model association task ───────────────────────────────────────────────────

/**
 * Build a caption association prompt: one correct caption + distractors from other cases.
 * Returns { prompt, correctIndex }.
 */
function buildAssociationPrompt(
  textChunk: ChunkMetadata,
  correctCaption: string,
  distractorCaptions: string[],
): { prompt: string; correctIndex: number } {
  // Shuffle correct + up to 3 distractors
  const candidates = [correctCaption, ...distractorCaptions.slice(0, 3)];
  // Fisher-Yates shuffle with fixed seed-ish (deterministic per chunk text length)
  const seed = textChunk.text.length % candidates.length;
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 7 + seed) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const correctIndex = shuffled.indexOf(correctCaption);

  const optionsList = shuffled.map((cap, i) => `${i + 1}. "${cap}"`).join('\n');

  const prompt = `You are a medical educator matching histology/pathology image captions to text passages.

TEXT PASSAGE (from ${textChunk.book} — ${textChunk.chapter}):
"${textChunk.text.substring(0, 400)}"

Which of the following image captions BEST matches an image that would illustrate this text passage?

${optionsList}

Reply with ONLY the number (1, 2, 3, or 4) of the best matching caption.`;

  return { prompt, correctIndex };
}

// ─── Bar chart helper ─────────────────────────────────────────────────────────

function bar(score: number, max = 10): string {
  const filled = Math.round((score / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function pct(n: number, total: number): string {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Image-Text Association Eval: GPT-5.4  vs  GPT-5.2  vs  GPT-4o');
  console.log('  Dimensions: caption_relevance / image_text_cohesion / cross_ref_hit / association_accuracy');
  console.log(`${'═'.repeat(78)}\n`);

  const alignmentTotals = {
    caption_relevance: 0,
    image_text_cohesion: 0,
    total: 0,
    count: 0,         // cases where images were actually retrieved
    crossRefHits: 0,
    crossRefTotal: 0,
    keywordHits: 0,
  };

  const modelTotals: Record<ModelKey, { correct: number; attempted: number }> = {
    gpt54: { correct: 0, attempted: 0 },
    gpt52: { correct: 0, attempted: 0 },
    gpt4o: { correct: 0, attempted: 0 },
  };

  // Collect all captions across cases first (for distractor pool)
  // We'll build this as we go — pre-seed with generic medical distractors
  const distractorPool: string[] = [
    'Photomicrograph showing normal hepatocyte architecture with central vein',
    'Electron micrograph of mitochondria in cardiac muscle cell',
    'H&E stain of normal renal cortex showing glomeruli and tubules',
    'Cross-section of normal alveoli with type I and type II pneumocytes',
    'Normal bone marrow biopsy showing hematopoietic cells and adipocytes',
    'Gross specimen of normal spleen showing red and white pulp',
    'PAS stain of basement membrane in normal glomerulus',
    'Silver stain showing reticulin fibers in normal liver',
  ];

  // Collect per-case results so we can print the final image captions as distractors
  const caseResults: Array<{
    tc: ImageTextTestCase;
    chunks: ChunkMetadata[];
    images: ImageResult[];
    alignment: AlignmentScore;
    crossRefs: number;
    keywordHit: boolean;
  }> = [];

  // ── Phase 1: Retrieval — fetch all context + images ────────────────────────
  console.log('  Phase 1 — Retrieval\n');

  for (const tc of TEST_CASES) {
    console.log(`  [${tc.id}] ${tc.query.substring(0, 60)}`);

    const chunks = await getContext(tc.query, undefined, false);
    const images = await getImagesHybrid(tc.query, chunks, 3);

    const crossRefs = crossRefHits(chunks, images);
    const keywordHit = tc.captionKeywords && images.length > 0
      ? images.some(img => captionKeywordHit(img.caption, tc.captionKeywords!))
      : false;

    const topCaption = images[0]?.caption ?? '(no image retrieved)';
    const topScore   = (images[0] as any)?.score?.toFixed(3) ?? '—';
    const chunkCount = chunks.length;
    const crossRefStr = crossRefs > 0 ? `✅ ${crossRefs} hit(s)` : '❌ 0 hits';

    console.log(`         text chunks: ${chunkCount}  images: ${images.length}  cross-ref: ${crossRefStr}`);
    console.log(`         top caption (score ${topScore}): "${topCaption.substring(0, 80)}"`);
    console.log(`         keyword hit: ${keywordHit ? '✅' : '❌'}\n`);

    // Collect captions for distractor pool
    for (const img of images) {
      if (img.caption && !distractorPool.includes(img.caption)) {
        distractorPool.push(img.caption);
      }
    }

    caseResults.push({ tc, chunks, images, alignment: { caption_relevance: 0, image_text_cohesion: 0, total: 0, rationale: '' }, crossRefs, keywordHit });

    alignmentTotals.crossRefHits   += crossRefs > 0 ? 1 : 0;
    alignmentTotals.crossRefTotal  += 1;
    if (keywordHit) alignmentTotals.keywordHits++;

    await new Promise(r => setTimeout(r, 300));
  }

  // ── Phase 2: LLM Alignment Scoring ────────────────────────────────────────
  console.log(`\n${'─'.repeat(78)}`);
  console.log('  Phase 2 — LLM Alignment Scoring\n');

  const alignmentScores = await Promise.all(
    caseResults.map(cr => judgeAlignment(cr.tc.query, cr.chunks, cr.images))
  );

  for (let i = 0; i < caseResults.length; i++) {
    caseResults[i].alignment = alignmentScores[i];
    const al = alignmentScores[i];
    const tc = caseResults[i].tc;
    console.log(`  [${tc.id}]  cap_relevance=${al.caption_relevance}/10  img_text_cohesion=${al.image_text_cohesion}/10  → ${al.total}/20`);
    console.log(`         ${al.rationale}`);

    if (caseResults[i].images.length > 0) {
      alignmentTotals.caption_relevance  += al.caption_relevance;
      alignmentTotals.image_text_cohesion += al.image_text_cohesion;
      alignmentTotals.total              += al.total;
      alignmentTotals.count++;
    }
  }

  // ── Phase 3: Model Association Accuracy ───────────────────────────────────
  console.log(`\n${'─'.repeat(78)}`);
  console.log('  Phase 3 — Model Caption Association Task\n');

  for (const cr of caseResults) {
    if (cr.images.length === 0 || cr.chunks.length === 0) {
      console.log(`  [${cr.tc.id}] Skipped — no images or no text chunks retrieved`);
      continue;
    }

    const correctCaption = cr.images[0].caption;
    if (!correctCaption || correctCaption.trim().length < 5) {
      console.log(`  [${cr.tc.id}] Skipped — empty caption`);
      continue;
    }

    // Build distractors: captions from other queries (exclude current correct)
    const distractors = distractorPool.filter(c => c !== correctCaption);

    const { prompt, correctIndex } = buildAssociationPrompt(
      cr.chunks[0],
      correctCaption,
      distractors,
    );

    console.log(`  [${cr.tc.id}] ${cr.tc.query.substring(0, 55)}`);
    console.log(`         correct answer: option ${correctIndex + 1} — "${correctCaption.substring(0, 60)}"`);

    // Run all models in parallel
    const modelAnswers = await Promise.all(
      MODELS.map(async m => {
        const { text } = await generateText({
          model: m.model,
          messages: [{ role: 'user', content: prompt }],
        });
        const picked = parseInt(text.trim().replace(/\D/g, ''), 10) - 1;
        const correct = picked === correctIndex;
        modelTotals[m.key].attempted++;
        if (correct) modelTotals[m.key].correct++;
        return { label: m.label, key: m.key, raw: text.trim(), picked, correct };
      })
    );

    for (const ma of modelAnswers) {
      const mark = ma.correct ? '✅' : `❌ (picked ${ma.picked + 1})`;
      console.log(`         ${ma.label.padEnd(10)} ${mark}`);
    }
    console.log('');

    await new Promise(r => setTimeout(r, 500));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const n = alignmentTotals.count;

  console.log(`${'═'.repeat(78)}`);
  console.log('  Overall Summary\n');

  // Retrieval alignment
  console.log('  Retrieval Alignment (LLM-judged, cases with images only)\n');
  console.log(`  Caption Relevance   avg: ${n > 0 ? (alignmentTotals.caption_relevance / n).toFixed(1) : '—'}/10  ${bar(n > 0 ? alignmentTotals.caption_relevance / n : 0)}`);
  console.log(`  Image-Text Cohesion avg: ${n > 0 ? (alignmentTotals.image_text_cohesion / n).toFixed(1) : '—'}/10  ${bar(n > 0 ? alignmentTotals.image_text_cohesion / n : 0)}`);
  console.log(`  Combined avg:            ${n > 0 ? (alignmentTotals.total / n).toFixed(1) : '—'}/20`);
  console.log('');

  // Structural checks
  console.log('  Structural Cross-Reference (image_ids in chunks ↔ getImages results)');
  console.log(`  Hit rate: ${alignmentTotals.crossRefHits}/${alignmentTotals.crossRefTotal} (${pct(alignmentTotals.crossRefHits, alignmentTotals.crossRefTotal)})`);
  console.log('');
  console.log('  Keyword Match (caption contains expected topic keywords)');
  console.log(`  Hit rate: ${alignmentTotals.keywordHits}/${TEST_CASES.filter(t => t.captionKeywords).length} (${pct(alignmentTotals.keywordHits, TEST_CASES.filter(t => t.captionKeywords).length)})`);
  console.log('');

  // Model association accuracy
  console.log('  Model Caption Association Accuracy\n');
  console.log(`  ${'Model'.padEnd(12)} ${'Correct'.padEnd(10)} ${'Attempted'.padEnd(11)} ${'Accuracy'}`);
  console.log(`  ${'─'.repeat(44)}`);

  const rankedModels = MODELS.map(m => ({ ...m, t: modelTotals[m.key] }))
    .sort((a, b) => (b.t.correct / (b.t.attempted || 1)) - (a.t.correct / (a.t.attempted || 1)));

  for (const { label, t } of rankedModels) {
    const acc = t.attempted > 0 ? (t.correct / t.attempted) : 0;
    console.log(
      `  ${label.padEnd(12)} ${t.correct.toString().padEnd(10)} ${t.attempted.toString().padEnd(11)} ${bar(acc * 10)} ${pct(t.correct, t.attempted)}`
    );
  }

  console.log(`\n  Association winner: ${rankedModels[0].label} (${pct(rankedModels[0].t.correct, rankedModels[0].t.attempted)} accuracy)`);
  console.log(`${'═'.repeat(78)}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
