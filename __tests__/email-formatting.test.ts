import { describe, it, expect } from 'vitest';
import { buildEmailHtml } from '@/lib/email';
import type { Fact } from '@/lib/facts-agent';

const SAMPLE_FACTS: Fact[] = [
  {
    topic: 'Nephrotic Syndrome',
    fact: 'Massive proteinuria greater than 3.5g/day.',
    source: 'First Aid — Renal',
    category: 'Nephrology',
    generatedAt: new Date('2026-01-15T10:00:00Z').getTime(),
  },
  {
    topic: 'MI',
    fact: 'Coagulative necrosis after 20 min ischemia.',
    source: 'Pathoma — Heart',
    category: 'Cardiology',
    generatedAt: new Date('2026-01-15T10:00:00Z').getTime(),
  },
];

describe('buildEmailHtml', () => {
  it('returns a valid HTML document string', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the title High-Yield USMLE Facts', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('High-Yield USMLE Facts');
  });

  it('renders each fact text', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('Massive proteinuria greater than 3.5g/day.');
    expect(html).toContain('Coagulative necrosis after 20 min ischemia.');
  });

  it('renders each category badge', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('Nephrology');
    expect(html).toContain('Cardiology');
  });

  it('renders each source', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('First Aid — Renal');
    expect(html).toContain('Pathoma — Heart');
  });

  it('uses the Cardiology accent color #ef4444', () => {
    const html = buildEmailHtml(SAMPLE_FACTS);
    expect(html).toContain('#ef4444');
  });

  it('uses a fallback color #6b7280 for unknown categories', () => {
    const unknownFact: Fact = {
      topic: 'Foo',
      fact: 'Bar.',
      source: 'Baz',
      category: 'UnknownCategory',
      generatedAt: Date.now(),
    };
    const html = buildEmailHtml([unknownFact]);
    const occurrences = (html.match(/#6b7280/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('handles empty facts array without throwing', () => {
    expect(() => buildEmailHtml([])).not.toThrow();
  });
});
