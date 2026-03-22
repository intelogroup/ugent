import { describe, it, expect } from "vitest";
import {
  calculateNextStep,
  getIntervalDays,
  calculateDueAt,
  filterDueCards,
  computeDeckStats,
  INTERVALS_DAYS,
} from "@/lib/spaced-repetition";

describe("spaced-repetition algorithm", () => {
  describe("calculateNextStep", () => {
    it("resets to step 0 on 'again'", () => {
      expect(calculateNextStep(3, "again")).toBe(0);
      expect(calculateNextStep(0, "again")).toBe(0);
      expect(calculateNextStep(4, "again")).toBe(0);
    });

    it("keeps the same step on 'hard'", () => {
      expect(calculateNextStep(0, "hard")).toBe(0);
      expect(calculateNextStep(2, "hard")).toBe(2);
      expect(calculateNextStep(4, "hard")).toBe(4);
    });

    it("advances one step on 'good'", () => {
      expect(calculateNextStep(0, "good")).toBe(1);
      expect(calculateNextStep(2, "good")).toBe(3);
    });

    it("caps at max step on 'good'", () => {
      expect(calculateNextStep(4, "good")).toBe(4);
    });

    it("advances two steps on 'easy'", () => {
      expect(calculateNextStep(0, "easy")).toBe(2);
      expect(calculateNextStep(1, "easy")).toBe(3);
    });

    it("caps at max step on 'easy'", () => {
      expect(calculateNextStep(3, "easy")).toBe(4);
      expect(calculateNextStep(4, "easy")).toBe(4);
    });
  });

  describe("getIntervalDays", () => {
    it("returns correct days for each step", () => {
      expect(getIntervalDays(0)).toBe(1);
      expect(getIntervalDays(1)).toBe(3);
      expect(getIntervalDays(2)).toBe(7);
      expect(getIntervalDays(3)).toBe(14);
      expect(getIntervalDays(4)).toBe(30);
    });

    it("clamps to max step for out-of-range values", () => {
      expect(getIntervalDays(10)).toBe(30);
    });
  });

  describe("calculateDueAt", () => {
    it("returns correct future timestamp", () => {
      const now = 1000000;
      const result = calculateDueAt(0, now);
      expect(result).toBe(now + 1 * 24 * 60 * 60 * 1000);
    });

    it("returns correct timestamp for step 2 (7 days)", () => {
      const now = 1000000;
      const result = calculateDueAt(2, now);
      expect(result).toBe(now + 7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("filterDueCards", () => {
    const now = 1000;

    it("returns cards that are due", () => {
      const cards = [
        { dueAt: 500, id: "a" },
        { dueAt: 1000, id: "b" },
        { dueAt: 2000, id: "c" },
      ];
      const due = filterDueCards(cards, now);
      expect(due).toHaveLength(2);
      expect(due[0].id).toBe("a");
      expect(due[1].id).toBe("b");
    });

    it("returns empty array when no cards are due", () => {
      const cards = [{ dueAt: 2000, id: "a" }];
      expect(filterDueCards(cards, now)).toHaveLength(0);
    });

    it("sorts by dueAt ascending", () => {
      const cards = [
        { dueAt: 800, id: "b" },
        { dueAt: 300, id: "a" },
        { dueAt: 999, id: "c" },
      ];
      const due = filterDueCards(cards, now);
      expect(due.map((c) => c.id)).toEqual(["a", "b", "c"]);
    });
  });

  describe("computeDeckStats", () => {
    it("computes correct stats", () => {
      const now = 1000;
      const cards = [
        { dueAt: 500, reviewCount: 3 },
        { dueAt: 1000, reviewCount: 0 },
        { dueAt: 2000, reviewCount: 1 },
      ];
      const stats = computeDeckStats(cards, now);
      expect(stats.due).toBe(2);
      expect(stats.total).toBe(3);
      expect(stats.reviewed).toBe(2);
    });

    it("handles empty deck", () => {
      const stats = computeDeckStats([], 1000);
      expect(stats).toEqual({ due: 0, total: 0, reviewed: 0 });
    });
  });

  describe("INTERVALS_DAYS", () => {
    it("has 5 intervals", () => {
      expect(INTERVALS_DAYS).toHaveLength(5);
    });

    it("intervals are strictly increasing", () => {
      for (let i = 1; i < INTERVALS_DAYS.length; i++) {
        expect(INTERVALS_DAYS[i]).toBeGreaterThan(INTERVALS_DAYS[i - 1]);
      }
    });
  });
});
