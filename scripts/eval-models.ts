/**
 * Model Comparison Eval: GPT-4o vs Gemini 5.2
 *
 * For each test case:
 *   1. Fetches RAG context from Pinecone (identical for both models)
 *   2. Runs the same prompt through both models
 *   3. Uses GPT-4o as an LLM judge to score accuracy, completeness, and clarity (0–10)
 *   4. Prints a side-by-side report
 *
 * Run: npx tsx scripts/eval-models.ts
 */

import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getContext, ChunkMetadata } from '../lib/pinecone';

dotenv.config({ path: process.env.ENV_FILE ?? '.env.production' });

// ─── Test questions ───────────────────────────────────────────────────────────

const QUESTIONS = [
  'What is apoptosis and how does it differ from necrosis?',
  'Explain the pathophysiology of myocardial infarction and the zones of injury',
  'What are the hallmarks of malignant neoplasia?',
  'Describe the coagulation cascade and Virchow triad',
  'What causes nephrotic syndrome and what are its clinical features?',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(context: ChunkMetadata[]): string {
  const contextString = context.length > 0
    ? context.map(c => `[${c.book} — ${c.chapter}]\n${c.text}`).join('\n\n')
    : 'No context found.';

  return `You are a medical education assistant helping a student study for USMLE Step 1.
Use the following textbook context as your primary source. Be concise and precise.

CONTEXT:
${contextString}`;
}

interface ModelScore {
  accuracy: number;
  completeness: number;
  clarity: number;
  total: number;
  rationale: string;
}

async function judgeResponse(
  question: string,
  context: ChunkMetadata[],
  response: string,
): Promise<ModelScore> {
  const contextSummary = context.map(c => `[${c.book} — ${c.chapter}]`).join(', ');

  const { text } = await generateText({
    model: openai('gpt-5.4'),
    prompt: `You are a medical education expert evaluating an AI tutor's answer for USMLE Step 1 students.

QUESTION: ${question}
SOURCES AVAILABLE: ${contextSummary}

ANSWER TO EVALUATE:
${response}

Score the answer on three dimensions (0–10 each):
- accuracy: factually correct per standard medical knowledge
- completeness: covers the key concepts needed to answer the question
- clarity: clear, well-organized, appropriate for a medical student

Respond with ONLY valid JSON in this exact shape:
{"accuracy": <int>, "completeness": <int>, "clarity": <int>, "rationale": "<one sentence>"}`,
  });

  try {
    const parsed = JSON.parse(text.trim());
    return {
      accuracy: parsed.accuracy,
      completeness: parsed.completeness,
      clarity: parsed.clarity,
      total: parsed.accuracy + parsed.completeness + parsed.clarity,
      rationale: parsed.rationale,
    };
  } catch {
    return { accuracy: 0, completeness: 0, clarity: 0, total: 0, rationale: 'Parse error' };
  }
}

function bar(score: number, max = 10): string {
  const filled = Math.round((score / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

// ─── Models under test ────────────────────────────────────────────────────────

const MODELS = [
  { key: 'gpt54',  label: 'GPT-5.4',  model: openai('gpt-5.4') },
  { key: 'gpt52',  label: 'GPT-5.2',  model: openai('gpt-5.2') },
  { key: 'gpt4o',  label: 'GPT-4o',   model: openai('gpt-4o') },
] as const;

type ModelKey = typeof MODELS[number]['key'];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Model Comparison: GPT-5.4  vs  GPT-5.2  vs  GPT-4o');
  console.log(`${'═'.repeat(78)}\n`);

  const totals: Record<ModelKey, { accuracy: number; completeness: number; clarity: number; total: number }> = {
    gpt54: { accuracy: 0, completeness: 0, clarity: 0, total: 0 },
    gpt52: { accuracy: 0, completeness: 0, clarity: 0, total: 0 },
    gpt4o: { accuracy: 0, completeness: 0, clarity: 0, total: 0 },
  };

  for (let i = 0; i < QUESTIONS.length; i++) {
    const question = QUESTIONS[i];
    console.log(`\n── Q${i + 1}: ${question}`);
    console.log(`${'─'.repeat(78)}`);

    // 1. Fetch RAG context once — identical input for all models
    const context = await getContext(question, undefined, false);
    const sources = context.map(c => `${c.book} > ${c.chapter}`).join(' | ');
    console.log(`   Sources (${context.length}): ${sources || 'none'}\n`);

    const systemPrompt = buildSystemPrompt(context);

    // 2. Run all three models in parallel
    const responses = await Promise.all(
      MODELS.map(m =>
        generateText({
          model: m.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          }).then(r => ({ key: m.key, label: m.label, text: r.text }))
      )
    );

    // 3. Judge all responses in parallel
    const scored = await Promise.all(
      responses.map(async r => ({
        ...r,
        score: await judgeResponse(question, context, r.text),
      }))
    );

    // 4. Print responses + scores
    for (const r of scored) {
      console.log(`  ── ${r.label}:`);
      console.log('  ' + r.text.replace(/\n/g, '\n  ').substring(0, 500));
      if (r.text.length > 500) console.log('  [truncated]');
      console.log('');
    }

    console.log('  Scores  (acc / complete / clarity / total)');
    for (const r of scored) {
      const s = r.score;
      console.log(
        `  ${r.label.padEnd(10)} ${bar(s.accuracy)} ${s.accuracy}/10  |  ${bar(s.completeness)} ${s.completeness}/10  |  ${bar(s.clarity)} ${s.clarity}/10  →  ${s.total}/30`
      );
      console.log(`             ${s.rationale}`);
    }

    const winner = scored.reduce((best, r) => r.score.total > best.score.total ? r : best);
    console.log(`\n  Winner: ${winner.label}`);

    // Accumulate
    for (const r of scored) {
      totals[r.key].accuracy     += r.score.accuracy;
      totals[r.key].completeness += r.score.completeness;
      totals[r.key].clarity      += r.score.clarity;
      totals[r.key].total        += r.score.total;
    }

    if (i < QUESTIONS.length - 1) await new Promise(res => setTimeout(res, 1000));
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const n = QUESTIONS.length;
  console.log(`\n${'═'.repeat(78)}`);
  console.log('  Final Summary\n');
  console.log(`  ${'Model'.padEnd(12)} ${'Accuracy'.padEnd(10)} ${'Complete'.padEnd(10)} ${'Clarity'.padEnd(10)} ${'Avg Total'}`);
  console.log(`  ${'─'.repeat(54)}`);

  const ranked = MODELS.map(m => ({ label: m.label, key: m.key, t: totals[m.key] }))
    .sort((a, b) => b.t.total - a.t.total);

  for (const { label, key } of ranked) {
    const t = totals[key];
    console.log(
      `  ${label.padEnd(12)} ${(t.accuracy / n).toFixed(1).padEnd(10)} ${(t.completeness / n).toFixed(1).padEnd(10)} ${(t.clarity / n).toFixed(1).padEnd(10)} ${(t.total / n).toFixed(1)}/30`
    );
  }

  console.log(`\n  Overall winner: ${ranked[0].label}`);
  console.log(`${'═'.repeat(78)}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
