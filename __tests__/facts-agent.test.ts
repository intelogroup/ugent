import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_FACTS_JSON = JSON.stringify({
  facts: [
    { topic: 'Nephrotic Syndrome', fact: 'Massive proteinuria >3.5g/day is the hallmark.', source: 'First Aid — Renal', category: 'Nephrology' },
    { topic: 'Minimal Change Disease', fact: '#1 cause in children; responds to steroids.', source: 'Pathoma — Kidneys', category: 'Nephrology' },
    { topic: 'Diabetes Mellitus', fact: 'Type 1: autoimmune beta-cell destruction. Type 2: insulin resistance.', source: 'First Aid — Endocrinology', category: 'Endocrinology' },
    { topic: 'MI Pathophysiology', fact: '>20 min ischemia → irreversible coagulative necrosis.', source: 'Pathoma — Heart', category: 'Cardiology' },
    { topic: 'SLE', fact: 'Anti-dsDNA and anti-Sm are SLE-specific; anti-histone = drug-induced.', source: 'First Aid — Immunology', category: 'Immunology' },
  ],
});

const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: MOCK_FACTS_JSON } }],
});

vi.mock('@/lib/pinecone', () => ({
  getContext: vi.fn().mockResolvedValue([
    { text: 'Nephrotic syndrome: massive proteinuria, hypoalbuminemia, edema, hyperlipidemia.', book: 'First Aid', chapter: 'Renal', section: '', subsection: '', image_ids: [] },
  ]),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

describe('generateFacts', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.PINECONE_API_KEY = 'test-key';
    process.env.PINECONE_INDEX_NAME = 'test-index';
    mockCreate.mockClear();
  });

  it('returns exactly 5 facts', async () => {
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    expect(facts).toHaveLength(5);
  });

  it('each fact has all required fields', async () => {
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    for (const fact of facts) {
      expect(fact).toHaveProperty('id');
      expect(fact).toHaveProperty('topic');
      expect(fact).toHaveProperty('fact');
      expect(fact).toHaveProperty('source');
      expect(fact).toHaveProperty('category');
      expect(fact).toHaveProperty('generatedAt');
      expect(typeof fact.fact).toBe('string');
      expect(fact.fact.length).toBeGreaterThan(0);
    }
  });

  it('each fact has a valid ISO generatedAt timestamp', async () => {
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    for (const fact of facts) {
      expect(new Date(fact.generatedAt).toString()).not.toBe('Invalid Date');
    }
  });

  it('fact ids are unique', async () => {
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    const ids = new Set(facts.map((f) => f.id));
    expect(ids.size).toBe(facts.length);
  });

  it('category is a non-empty string', async () => {
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    for (const fact of facts) {
      expect(typeof fact.category).toBe('string');
      expect(fact.category.length).toBeGreaterThan(0);
    }
  });

  it('falls back to 5 static facts when OpenAI returns invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'NOT_VALID_JSON' } }] });
    const { generateFacts } = await import('@/lib/facts-agent');
    const facts = await generateFacts();
    expect(facts).toHaveLength(5);
    for (const fact of facts) {
      expect(fact.id).toMatch(/^fallback-/);
    }
  });
});
