/**
 * RAG Evaluation Suite
 *
 * Tests retrieval quality across three failure categories:
 *   1. Content queries  — should always work
 *   2. Structural queries — currently fail (no chapter numbers in metadata)
 *   3. Mixed queries    — content + structural reference
 *
 * Run: npx tsx scripts/eval-rag.ts
 * Uses .env.production by default. Override with ENV_FILE=.env.local
 */
import dotenv from 'dotenv';
import { getContext } from '../lib/pinecone';

dotenv.config({ path: process.env.ENV_FILE ?? '.env.production' });

// ─── Test definitions ────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  category: 'content' | 'structural' | 'mixed';
  query: string;
  /** At least one returned chunk must match this book substring */
  expectedBook?: string;
  /** At least one returned chunk must match this chapter substring (case-insensitive) */
  expectedChapter?: string;
  /** Minimum score of the top result (0–1). Below this = poor retrieval. */
  minTopScore?: number;
  /** Known to fail currently — marks as KNOWN_FAIL instead of FAIL */
  knownFail?: boolean;
}

const TEST_CASES: TestCase[] = [
  // ── Pathoma content queries ────────────────────────────────────────────────
  {
    id: 'P-C-01',
    category: 'content',
    query: 'What is apoptosis?',
    expectedBook: 'Pathoma',
    expectedChapter: 'Growth Adaptations',
  },
  {
    id: 'P-C-02',
    category: 'content',
    query: 'Describe the process of cell swelling in cellular injury',
    expectedBook: 'Pathoma',
    expectedChapter: 'Growth Adaptations',
  },
  {
    id: 'P-C-03',
    category: 'content',
    query: 'What are the hallmarks of malignant neoplasia?',
    expectedBook: 'Pathoma',
    expectedChapter: 'Neoplasia',
  },
  {
    id: 'P-C-04',
    category: 'content',
    query: 'Explain the coagulation cascade and platelet plug formation',
    expectedBook: 'Pathoma',
    expectedChapter: 'Hemostasis',
  },
  {
    id: 'P-C-05',
    category: 'content',
    query: 'What causes acute MI and what are the zones of infarction?',
    expectedBook: 'Pathoma',
    expectedChapter: 'Cardiac',
  },
  {
    id: 'P-C-06',
    category: 'content',
    query: 'Describe glomerulonephritis and nephrotic syndrome differences',
    expectedBook: 'Pathoma',
    expectedChapter: 'Kidney',
  },
  {
    id: 'P-C-07',
    category: 'content',
    query: 'What are Virchow triad components in thrombosis?',
    expectedBook: 'Pathoma',
    expectedChapter: 'Hemostasis', // Virchow triad lives in Hemostasis ch, not Vascular
  },
  {
    id: 'P-C-08',
    category: 'content',
    query: 'Describe the pathology of Hodgkin lymphoma',
    expectedBook: 'Pathoma',
    expectedChapter: 'White Blood Cell',
  },

  // ── Pathoma structural queries (currently fail) ────────────────────────────
  {
    id: 'P-S-01',
    category: 'structural',
    query: 'What is covered in chapter 1 of Pathoma?',
    expectedBook: 'Pathoma',
    expectedChapter: 'Growth Adaptations',
  },
  {
    id: 'P-S-02',
    category: 'structural',
    query: 'first chapter of pathoma',
    expectedBook: 'Pathoma',
    expectedChapter: 'Growth Adaptations',
  },
  {
    id: 'P-S-03',
    category: 'structural',
    query: 'Pathoma chapter 3',
    expectedBook: 'Pathoma',
    expectedChapter: 'Neoplasia',
  },
  {
    id: 'P-S-04',
    category: 'structural',
    query: 'chapter 5 pathoma red blood cells',
    expectedBook: 'Pathoma',
    expectedChapter: 'Red Blood Cell',
  },

  // ── Pathoma mixed queries ──────────────────────────────────────────────────
  {
    id: 'P-M-01',
    category: 'mixed',
    query: 'apoptosis from chapter 1 of pathoma',
    expectedBook: 'Pathoma',
    expectedChapter: 'Growth Adaptations',
    // Content keyword "apoptosis" may rescue this
  },
  {
    id: 'P-M-02',
    category: 'mixed',
    query: 'inflammation chapter 2 pathoma',
    expectedBook: 'Pathoma',
    expectedChapter: 'Inflammation',
  },
  {
    id: 'P-M-03',
    category: 'mixed',
    query: 'neoplasia principles chapter 3',
    expectedBook: 'Pathoma',
    expectedChapter: 'Neoplasia',
  },

  // ── First Aid content queries ──────────────────────────────────────────────
  {
    id: 'FA-C-01',
    category: 'content',
    query: 'What is the mechanism of beta-lactam antibiotics?',
    expectedBook: 'First Aid',
  },
  {
    id: 'FA-C-02',
    category: 'content',
    query: 'Explain T cell activation and the role of MHC molecules',
    expectedBook: 'First Aid',
  },
  {
    id: 'FA-C-03',
    category: 'content',
    query: 'What are the causes of metabolic acidosis?',
    expectedBook: 'First Aid',
  },
  {
    id: 'FA-C-04',
    category: 'content',
    query: 'Describe the urea cycle and its disorders',
    expectedBook: 'First Aid',
  },

  // ── Cross-book queries ─────────────────────────────────────────────────────
  {
    id: 'X-C-01',
    category: 'content',
    query: 'myocardial infarction pathology and treatment',
    expectedBook: 'Pathoma',
    minTopScore: 0.5,
  },
  {
    id: 'X-C-02',
    category: 'content',
    query: 'nephrotic syndrome diagnosis and management',
    expectedBook: 'Pathoma',
    minTopScore: 0.5,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  category: string;
  query: string;
  passed: boolean;
  knownFail: boolean;
  topScore: number;
  resultCount: number;
  topBook: string;
  topChapter: string;
  failure?: string;
}

async function runTest(tc: TestCase): Promise<TestResult> {
  const base = {
    id: tc.id,
    category: tc.category,
    query: tc.query,
    knownFail: tc.knownFail ?? false,
    topScore: 0,
    resultCount: 0,
    topBook: '',
    topChapter: '',
  };

  try {
    const context = await getContext(tc.query, undefined, true);
    const topScore = (context[0] as any)?.score ?? 0;
    const topBook = context[0]?.book ?? '';
    const topChapter = context[0]?.chapter ?? '';

    const failures: string[] = [];

    if (context.length === 0) {
      failures.push('No context returned');
    }

    if (tc.minTopScore !== undefined && topScore < tc.minTopScore) {
      failures.push(`Top score ${topScore.toFixed(3)} < threshold ${tc.minTopScore}`);
    }

    if (tc.expectedBook) {
      const bookMatch = context.some(c =>
        c.book.toLowerCase().includes(tc.expectedBook!.toLowerCase())
      );
      if (!bookMatch) {
        failures.push(`Expected book "${tc.expectedBook}" not in results (got: ${topBook})`);
      }
    }

    if (tc.expectedChapter) {
      const chapterMatch = context.some(c =>
        (c.chapter ?? '').toLowerCase().includes(tc.expectedChapter!.toLowerCase())
      );
      if (!chapterMatch) {
        failures.push(
          `Expected chapter "${tc.expectedChapter}" not in results (got: "${topChapter}")`
        );
      }
    }

    return {
      ...base,
      topScore,
      resultCount: context.length,
      topBook,
      topChapter,
      passed: failures.length === 0,
      failure: failures.length > 0 ? failures.join('; ') : undefined,
    };
  } catch (err: any) {
    return {
      ...base,
      passed: false,
      failure: `Exception: ${err.message}`,
    };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'─'.repeat(70)}`);
  console.log('  RAG Evaluation Suite');
  console.log(`${'─'.repeat(70)}\n`);

  const results: TestResult[] = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`  [${tc.id}] ${tc.query.substring(0, 55).padEnd(55)} `);
    const result = await runTest(tc);
    results.push(result);

    if (result.passed) {
      console.log(`✅  score=${result.topScore.toFixed(3)} book="${result.topBook.substring(0, 20)}"`);
    } else if (result.knownFail) {
      console.log(`⚠️  KNOWN_FAIL: ${result.failure}`);
    } else {
      console.log(`❌  FAIL: ${result.failure}`);
    }

    // Small delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(70)}`);
  console.log('  Summary by category\n');

  const categories = ['content', 'structural', 'mixed'] as const;
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const passed = catResults.filter(r => r.passed).length;
    const knownFails = catResults.filter(r => !r.passed && r.knownFail).length;
    const realFails = catResults.filter(r => !r.passed && !r.knownFail).length;
    console.log(
      `  ${cat.padEnd(12)}: ${passed}/${catResults.length} passed` +
        (knownFails ? `, ${knownFails} known-fail` : '') +
        (realFails ? `, ${realFails} UNEXPECTED FAIL` : '')
    );
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalUnexpectedFails = results.filter(r => !r.passed && !r.knownFail).length;
  console.log(`\n  Total: ${totalPassed}/${results.length} passed`);

  if (totalUnexpectedFails > 0) {
    console.log(`\n  ❌ ${totalUnexpectedFails} unexpected failure(s) — investigate before shipping`);
    process.exit(1);
  } else {
    console.log(`\n  ✅ All non-known failures passed`);
  }

  console.log(`${'─'.repeat(70)}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
