import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Fact } from '@/lib/facts-agent';

const SAMPLE_FACTS: Fact[] = [
  {
    topic: 'MI',
    fact: 'Coagulative necrosis after 20 min ischemia.',
    source: 'Pathoma — Heart',
    category: 'Cardiology',
    generatedAt: new Date('2026-01-01T12:00:00Z').getTime(),
  },
  {
    topic: 'SLE',
    fact: 'Anti-dsDNA is specific for SLE.',
    source: 'First Aid — Immunology',
    category: 'Immunology',
    generatedAt: new Date('2026-01-01T12:00:00Z').getTime(),
  },
];

describe('buildFactsText', () => {
  it('starts with the 🩺 header line', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    const text = buildFactsText(SAMPLE_FACTS);
    expect(text).toMatch(/^🩺 \*High-Yield USMLE Facts\*/);
  });

  it('includes each fact numbered', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    const text = buildFactsText(SAMPLE_FACTS);
    expect(text).toContain('1.');
    expect(text).toContain('2.');
  });

  it('includes category labels in brackets', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    const text = buildFactsText(SAMPLE_FACTS);
    expect(text).toContain('[Cardiology]');
    expect(text).toContain('[Immunology]');
  });

  it('includes source lines', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    const text = buildFactsText(SAMPLE_FACTS);
    expect(text).toContain('Pathoma — Heart');
    expect(text).toContain('First Aid — Immunology');
  });

  it('ends with Powered by UGent MedBot', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    const text = buildFactsText(SAMPLE_FACTS);
    expect(text).toContain('Powered by UGent MedBot');
  });

  it('handles empty facts array without throwing', async () => {
    const { buildFactsText } = await import('@/lib/telegram');
    expect(() => buildFactsText([])).not.toThrow();
  });
});

describe('sendTelegramFactsToAll — env parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('skips and warns when TELEGRAM_RECIPIENTS is empty', async () => {
    delete process.env.TELEGRAM_RECIPIENTS;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules();
    const { sendTelegramFactsToAll } = await import('@/lib/telegram');
    await sendTelegramFactsToAll(SAMPLE_FACTS);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TELEGRAM_RECIPIENTS'));
    warnSpy.mockRestore();
  });
});
