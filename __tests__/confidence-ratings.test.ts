import { describe, it, expect } from 'vitest';

// Mirror of rating validation in convex/confidenceRatings.ts setRating handler
const isValidRating = (r: number) => r >= 1 && r <= 5;

// Mirror of getAverageConfidence calculation
function computeAverage(ratings: number[]): { average: number; totalRated: number } | null {
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  return { average: Math.round(avg * 10) / 10, totalRated: ratings.length };
}

describe('confidenceRatings — rating validation', () => {
  it('rejects rating 0 (below minimum)', () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(-1)).toBe(false);
  });

  it('rejects rating 6 (above maximum)', () => {
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(10)).toBe(false);
  });

  it('accepts ratings 1 through 5', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(isValidRating(r)).toBe(true);
    }
  });
});

describe('confidenceRatings — average calculation', () => {
  it('returns null for empty ratings list', () => {
    expect(computeAverage([])).toBeNull();
  });

  it('returns correct average and count for single rating', () => {
    expect(computeAverage([4])).toEqual({ average: 4, totalRated: 1 });
  });

  it('rounds average to one decimal place', () => {
    expect(computeAverage([1, 2, 3])).toEqual({ average: 2, totalRated: 3 });
    expect(computeAverage([1, 2])).toEqual({ average: 1.5, totalRated: 2 });
  });

  it('rounds (4 + 5 + 5) / 3 = 4.666... → 4.7', () => {
    expect(computeAverage([4, 5, 5])).toEqual({ average: 4.7, totalRated: 3 });
  });

  it('returns totalRated equal to the array length', () => {
    const result = computeAverage([1, 2, 3, 4, 5]);
    expect(result?.totalRated).toBe(5);
  });
});

describe('confidenceRatings — listRatings map format', () => {
  it('builds "bookSlug:chapterNumber" → rating map correctly', () => {
    const rows = [
      { bookSlug: 'pathoma', chapterNumber: 1, rating: 3 },
      { bookSlug: 'pathoma', chapterNumber: 2, rating: 5 },
      { bookSlug: 'first-aid', chapterNumber: 8, rating: 4 },
    ];
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[`${r.bookSlug}:${r.chapterNumber}`] = r.rating;
    }
    expect(map).toEqual({
      'pathoma:1': 3,
      'pathoma:2': 5,
      'first-aid:8': 4,
    });
  });
});
