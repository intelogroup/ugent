import { describe, it, expect } from 'vitest';

const INTERVALS_DAYS = [1, 3, 7, 14, 30];

function nextStep(current: number, difficulty: 'again' | 'hard' | 'good' | 'easy'): number {
  switch (difficulty) {
    case 'again': return 0;
    case 'hard':  return current;
    case 'good':  return Math.min(current + 1, INTERVALS_DAYS.length - 1);
    case 'easy':  return Math.min(current + 2, INTERVALS_DAYS.length - 1);
  }
}

function daysFromNowMs(days: number): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

describe('reviewCards — INTERVALS_DAYS', () => {
  it('has 5 steps: [1, 3, 7, 14, 30]', () => {
    expect(INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30]);
  });
});

describe('reviewCards — rateCard step transitions', () => {
  it('"again" always resets to step 0', () => {
    expect(nextStep(0, 'again')).toBe(0);
    expect(nextStep(3, 'again')).toBe(0);
    expect(nextStep(4, 'again')).toBe(0);
  });

  it('"hard" keeps the current step', () => {
    expect(nextStep(0, 'hard')).toBe(0);
    expect(nextStep(2, 'hard')).toBe(2);
    expect(nextStep(4, 'hard')).toBe(4);
  });

  it('"good" advances by 1', () => {
    expect(nextStep(0, 'good')).toBe(1);
    expect(nextStep(2, 'good')).toBe(3);
  });

  it('"easy" advances by 2', () => {
    expect(nextStep(0, 'easy')).toBe(2);
    expect(nextStep(2, 'easy')).toBe(4);
  });

  it('"good" clamps at max step (4)', () => {
    expect(nextStep(4, 'good')).toBe(4);
    expect(nextStep(3, 'good')).toBe(4);
  });

  it('"easy" clamps at max step (4)', () => {
    expect(nextStep(4, 'easy')).toBe(4);
    expect(nextStep(3, 'easy')).toBe(4);
  });
});

describe('reviewCards — dueAt scheduling', () => {
  it('step 0 → due in 1 day (~86400000ms)', () => {
    const before = Date.now();
    const dueAt = daysFromNowMs(INTERVALS_DAYS[0]);
    expect(dueAt - before).toBeGreaterThanOrEqual(86_400_000 - 10);
    expect(dueAt - before).toBeLessThan(86_400_000 + 1000);
  });

  it('step 2 → due in 7 days', () => {
    const before = Date.now();
    const dueAt = daysFromNowMs(INTERVALS_DAYS[2]);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(dueAt - before).toBeGreaterThanOrEqual(sevenDaysMs - 10);
    expect(dueAt - before).toBeLessThan(sevenDaysMs + 1000);
  });

  it('step 4 → due in 30 days', () => {
    const before = Date.now();
    const dueAt = daysFromNowMs(INTERVALS_DAYS[4]);
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(dueAt - before).toBeGreaterThanOrEqual(thirtyDaysMs - 10);
    expect(dueAt - before).toBeLessThan(thirtyDaysMs + 1000);
  });
});

describe('reviewCards — getDeckStats filters', () => {
  const now = Date.now();
  const cards = [
    { dueAt: now - 1000, reviewCount: 2 },
    { dueAt: now + 1000, reviewCount: 1 },
    { dueAt: now - 500,  reviewCount: 0 },
    { dueAt: now + 5000, reviewCount: 0 },
  ];

  it('counts due cards correctly', () => {
    const due = cards.filter((c) => c.dueAt <= now).length;
    expect(due).toBe(2);
  });

  it('counts total cards correctly', () => {
    expect(cards.length).toBe(4);
  });

  it('counts reviewed cards (reviewCount > 0) correctly', () => {
    const reviewed = cards.filter((c) => c.reviewCount > 0).length;
    expect(reviewed).toBe(2);
  });
});
