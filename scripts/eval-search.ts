/**
 * Search/RAG Utilization Eval: GPT-5.4 vs GPT-5.2 vs GPT-4o
 *
 * Tests how well each model uses the retrieved context, not just whether
 * the answer is medically correct. Four dimensions:
 *
 *   context_use   — does the model cite/use the retrieved chunks?
 *   faithfulness  — does it stay within context without hallucinating?
 *   source_aware  — does it correctly identify source gaps or missing info?
 *   synthesis     — does it combine multiple chunks coherently?
 *
 * Test cases cover three scenarios:
 *   IN_CONTEXT   — answer is clearly in the retrieved chunks
 *   PARTIAL      — answer partially in context; remainder needs inference
 *   OUT_OF_SCOPE — query is outside both books; model should flag this
 *
 * Run: npx tsx scripts/eval-search.ts
 */

import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getContext, ChunkMetadata } from '../lib/pinecone';

dotenv.config({ path: process.env.ENV_FILE ?? '.env.production' });

// ─── Test cases ───────────────────────────────────────────────────────────────

type Scenario = 'IN_CONTEXT' | 'PARTIAL' | 'OUT_OF_SCOPE';

interface SearchTestCase {
  id: string;
  scenario: Scenario;
  query: string;
  /** Substring(s) that MUST appear in a good answer (from context) */
  mustContain?: string[];
  /** Substring(s) that should NOT appear (hallucination markers) */
  mustNotContain?: string[];
  /** For OUT_OF_SCOPE: model should acknowledge the info isn't in the textbooks */
  expectsGapAcknowledgement?: boolean;
}

const TEST_CASES: SearchTestCase[] = [
  // ── IN_CONTEXT: answer is clearly in retrieved chunks ─────────────────────
  {
    id: 'S-IC-01',
    scenario: 'IN_CONTEXT',
    query: 'What are the morphologic changes of coagulative necrosis?',
    mustContain: ['coagulat', 'necrosis'],
  },
  {
    id: 'S-IC-02',
    scenario: 'IN_CONTEXT',
    query: 'What is minimal change disease and who does it affect?',
    mustContain: ['minimal change', 'podocyte'],
  },
  {
    id: 'S-IC-03',
    scenario: 'IN_CONTEXT',
    query: 'Describe the Reed-Sternberg cell in Hodgkin lymphoma',
    mustContain: ['Reed-Sternberg'],
  },
  {
    id: 'S-IC-04',
    scenario: 'IN_CONTEXT',
    query: 'What is the difference between hypertrophy and hyperplasia?',
    mustContain: ['hypertrophy', 'hyperplasia'],
  },

  // ── PARTIAL: context has some info; model must infer or acknowledge gaps ───
  {
    id: 'S-P-01',
    scenario: 'PARTIAL',
    query: 'How do you treat acute MI in the emergency department?',
    // Context has pathology but not ED management protocols
    expectsGapAcknowledgement: true,
  },
  {
    id: 'S-P-02',
    scenario: 'PARTIAL',
    query: 'What is the CHADS2 score and how is it used in atrial fibrillation?',
    // Scoring systems may not be in Pathoma/First Aid chunks
    expectsGapAcknowledgement: true,
  },
  {
    id: 'S-P-03',
    scenario: 'PARTIAL',
    query: 'What lab values distinguish nephrotic from nephritic syndrome?',
    mustContain: ['protein'],
  },

  // ── OUT_OF_SCOPE: completely outside both textbooks ───────────────────────
  {
    id: 'S-OOS-01',
    scenario: 'OUT_OF_SCOPE',
    query: 'What are the side effects of the COVID-19 mRNA vaccine?',
    expectsGapAcknowledgement: true,
    mustNotContain: ['First Aid', 'Pathoma'],  // should NOT falsely attribute
  },
  {
    id: 'S-OOS-02',
    scenario: 'OUT_OF_SCOPE',
    query: 'How does CRISPR-Cas9 gene editing work?',
    expectsGapAcknowledgement: true,
  },
  {
    id: 'S-OOS-03',
    scenario: 'OUT_OF_SCOPE',
    query: 'What is the current standard of care for checkpoint inhibitor toxicity?',
    expectsGapAcknowledgement: true,
  },
];

// ─── Models ───────────────────────────────────────────────────────────────────

const MODELS = [
  { key: 'gpt54', label: 'GPT-5.4', model: openai('gpt-5.4') },
  { key: 'gpt52', label: 'GPT-5.2', model: openai('gpt-5.2') },
  { key: 'gpt4o', label: 'GPT-4o',  model: openai('gpt-4o') },
] as const;

type ModelKey = typeof MODELS[number]['key'];

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(context: ChunkMetadata[]): string {
  const contextString = context.length > 0
    ? context.map(c => `[${c.book} — ${c.chapter}]\n${c.text}`).join('\n\n')
    : 'No relevant context found in the textbooks.';

  return `You are a medical education assistant helping a USMLE Step 1 student.
You have access to the following textbook excerpts from First Aid and Pathoma.
ONLY use this context as your primary source.
If the context does not cover the question, say so explicitly before using general knowledge.

TEXTBOOK CONTEXT:
${contextString}`;
}

// ─── Judge ────────────────────────────────────────────────────────────────────

interface SearchScore {
  context_use: number;
  faithfulness: number;
  source_aware: number;
  synthesis: number;
  total: number;
  rationale: string;
}

async function judgeSearchResponse(
  tc: SearchTestCase,
  context: ChunkMetadata[],
  response: string,
): Promise<SearchScore> {
  const contextSummary = context.length > 0
    ? context.map(c => `[${c.book} — ${c.chapter}]`).join(', ')
    : 'No context retrieved';

  const { text } = await generateText({
    model: openai('gpt-5.4'),
    prompt: `You are evaluating how well an AI medical tutor uses retrieved textbook context in its answer.

SCENARIO: ${tc.scenario}
QUESTION: ${tc.query}
RETRIEVED CONTEXT SOURCES: ${contextSummary}
${tc.expectsGapAcknowledgement ? 'NOTE: The model should acknowledge if information is not in the provided context.' : ''}

RESPONSE TO EVALUATE:
${response}

Score on 4 dimensions (0–10 each):
- context_use: Did the model actively use the retrieved context chunks to answer? (0 = ignored context, 10 = built answer directly from context)
- faithfulness: Did the model stay true to what the context says without fabricating facts not in context? (0 = hallucinated heavily, 10 = fully grounded)
- source_aware: Did the model correctly identify when information was/wasn't in the provided context, and flag gaps appropriately? (0 = false confidence / missed gaps, 10 = precise about what context covers)
- synthesis: Did the model coherently combine information from multiple context chunks? (0 = copied one chunk, 10 = synthesized multiple sources well)

Respond ONLY with valid JSON:
{"context_use": <int>, "faithfulness": <int>, "source_aware": <int>, "synthesis": <int>, "rationale": "<one sentence>"}`,
  });

  try {
    const p = JSON.parse(text.trim());
    return {
      context_use:  p.context_use,
      faithfulness: p.faithfulness,
      source_aware: p.source_aware,
      synthesis:    p.synthesis,
      total: p.context_use + p.faithfulness + p.source_aware + p.synthesis,
      rationale: p.rationale,
    };
  } catch {
    return { context_use: 0, faithfulness: 0, source_aware: 0, synthesis: 0, total: 0, rationale: 'Parse error' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bar(score: number, max = 10): string {
  const filled = Math.round((score / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function scenarioBadge(s: Scenario): string {
  return s === 'IN_CONTEXT' ? '[IN CTX]' : s === 'PARTIAL' ? '[PARTIAL]' : '[OUT OOS]';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Search/RAG Utilization Eval: GPT-5.4  vs  GPT-5.2  vs  GPT-4o');
  console.log('  Dimensions: context_use / faithfulness / source_awareness / synthesis');
  console.log(`${'═'.repeat(78)}\n`);

  const totals: Record<ModelKey, { context_use: number; faithfulness: number; source_aware: number; synthesis: number; total: number; wins: number }> = {
    gpt54: { context_use: 0, faithfulness: 0, source_aware: 0, synthesis: 0, total: 0, wins: 0 },
    gpt52: { context_use: 0, faithfulness: 0, source_aware: 0, synthesis: 0, total: 0, wins: 0 },
    gpt4o: { context_use: 0, faithfulness: 0, source_aware: 0, synthesis: 0, total: 0, wins: 0 },
  };

  const scenarioTotals: Record<Scenario, Record<ModelKey, number>> = {
    IN_CONTEXT:   { gpt54: 0, gpt52: 0, gpt4o: 0 },
    PARTIAL:      { gpt54: 0, gpt52: 0, gpt4o: 0 },
    OUT_OF_SCOPE: { gpt54: 0, gpt52: 0, gpt4o: 0 },
  };

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n── ${tc.id} ${scenarioBadge(tc.scenario)}: ${tc.query}`);
    console.log(`${'─'.repeat(78)}`);

    const context = await getContext(tc.query, undefined, false);
    const sources = context.length > 0
      ? context.slice(0, 3).map(c => `${c.book.replace('First Aid for the USMLE Step 1 2023', 'FA').replace('Pathoma 2021', 'Pathoma')} › ${c.chapter}`).join(' | ')
      : 'none';
    console.log(`   Context (${context.length} chunks): ${sources}\n`);

    const systemPrompt = buildSystemPrompt(context);

    // Run all models in parallel
    const responses = await Promise.all(
      MODELS.map(m =>
        generateText({
          model: m.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: tc.query },
          ],
        }).then(r => ({ key: m.key, label: m.label, text: r.text }))
      )
    );

    // Judge all in parallel
    const scored = await Promise.all(
      responses.map(async r => ({
        ...r,
        score: await judgeSearchResponse(tc, context, r.text),
      }))
    );

    // Print abbreviated responses + scores
    for (const r of scored) {
      const preview = r.text.replace(/\n/g, ' ').substring(0, 200);
      console.log(`  ${r.label}: ${preview}${r.text.length > 200 ? '…' : ''}`);
    }

    console.log('\n  Scores  (ctx_use / faithful / src_aware / synthesis / total)');
    for (const r of scored) {
      const s = r.score;
      console.log(
        `  ${r.label.padEnd(10)} ${bar(s.context_use)} ${s.context_use}  |  ${bar(s.faithfulness)} ${s.faithfulness}  |  ${bar(s.source_aware)} ${s.source_aware}  |  ${bar(s.synthesis)} ${s.synthesis}  → ${s.total}/40`
      );
      console.log(`             ${s.rationale}`);

      totals[r.key as ModelKey].context_use  += s.context_use;
      totals[r.key as ModelKey].faithfulness += s.faithfulness;
      totals[r.key as ModelKey].source_aware += s.source_aware;
      totals[r.key as ModelKey].synthesis    += s.synthesis;
      totals[r.key as ModelKey].total        += s.total;
      scenarioTotals[tc.scenario][r.key as ModelKey] += s.total;
    }

    const winner = scored.reduce((best, r) => r.score.total > best.score.total ? r : best);
    totals[winner.key as ModelKey].wins++;
    console.log(`  Winner: ${winner.label}`);

    if (i < TEST_CASES.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const n = TEST_CASES.length;
  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Overall Summary\n');
  console.log(`  ${'Model'.padEnd(10)} ${'Ctx Use'.padEnd(9)} ${'Faithful'.padEnd(9)} ${'Src Aware'.padEnd(10)} ${'Synthesis'.padEnd(10)} ${'Avg/40'.padEnd(8)} ${'Wins'}`);
  console.log(`  ${'─'.repeat(62)}`);

  const ranked = MODELS.map(m => ({ ...m, t: totals[m.key] }))
    .sort((a, b) => b.t.total - a.t.total);

  for (const { label, key, t } of ranked) {
    console.log(
      `  ${label.padEnd(10)} ${(t.context_use / n).toFixed(1).padEnd(9)} ${(t.faithfulness / n).toFixed(1).padEnd(9)} ${(t.source_aware / n).toFixed(1).padEnd(10)} ${(t.synthesis / n).toFixed(1).padEnd(10)} ${(t.total / n).toFixed(1).padEnd(8)} ${t.wins}/${n}`
    );
  }

  // Per-scenario breakdown
  console.log('\n  Per-scenario avg total/40\n');
  console.log(`  ${'Scenario'.padEnd(14)} ${'GPT-5.4'.padEnd(10)} ${'GPT-5.2'.padEnd(10)} ${'GPT-4o'}`);
  console.log(`  ${'─'.repeat(40)}`);
  for (const scenario of ['IN_CONTEXT', 'PARTIAL', 'OUT_OF_SCOPE'] as Scenario[]) {
    const counts = { IN_CONTEXT: 4, PARTIAL: 3, OUT_OF_SCOPE: 3 };
    const c = counts[scenario];
    const st = scenarioTotals[scenario];
    console.log(
      `  ${scenario.padEnd(14)} ${(st.gpt54 / c).toFixed(1).padEnd(10)} ${(st.gpt52 / c).toFixed(1).padEnd(10)} ${(st.gpt4o / c).toFixed(1)}`
    );
  }

  console.log(`\n  Overall winner: ${ranked[0].label} (${ranked[0].t.wins}/${n} wins)`);
  console.log(`${'═'.repeat(78)}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
