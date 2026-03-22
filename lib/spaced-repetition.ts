/**
 * SM-2-inspired spaced repetition engine.
 *
 * Core algorithm is exported as pure functions for testing.
 * Review state is now persisted in Convex (reviewCards table).
 * localStorage-based functions are kept for backwards compatibility
 * but the review page uses Convex-backed storage.
 *
 * Intervals (in days): 1 → 3 → 7 → 14 → 30  (capped)
 * Difficulty ratings: "again" resets to day 1, "hard" keeps interval,
 * "good" advances one step, "easy" advances two steps.
 */

export const INTERVALS_DAYS = [1, 3, 7, 14, 30];

export type Difficulty = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  bookmarkId: string;
  question: string;
  answer: string;
  /** ISO string — when the card is next due */
  dueAt: string;
  /** Current interval step index (0-based into INTERVALS) */
  intervalStep: number;
  /** Number of times reviewed */
  reviewCount: number;
}

// ─── Pure algorithm functions (testable) ───────────────────────────────────

/**
 * Calculate the next interval step given a difficulty rating.
 */
export function calculateNextStep(
  currentStep: number,
  difficulty: Difficulty
): number {
  switch (difficulty) {
    case "again":
      return 0;
    case "hard":
      return currentStep; // stay at current step
    case "good":
      return Math.min(currentStep + 1, INTERVALS_DAYS.length - 1);
    case "easy":
      return Math.min(currentStep + 2, INTERVALS_DAYS.length - 1);
  }
}

/**
 * Get the number of days until the next review for a given step.
 */
export function getIntervalDays(step: number): number {
  return INTERVALS_DAYS[Math.min(step, INTERVALS_DAYS.length - 1)];
}

/**
 * Calculate the due date (ms timestamp) given a step and a reference time.
 */
export function calculateDueAt(step: number, fromMs: number = Date.now()): number {
  return fromMs + getIntervalDays(step) * 24 * 60 * 60 * 1000;
}

/**
 * Filter and sort cards that are due for review.
 */
export function filterDueCards<T extends { dueAt: number }>(
  cards: T[],
  nowMs: number = Date.now()
): T[] {
  return cards
    .filter((c) => c.dueAt <= nowMs)
    .sort((a, b) => a.dueAt - b.dueAt);
}

/**
 * Compute deck statistics.
 */
export function computeDeckStats<T extends { dueAt: number; reviewCount: number }>(
  cards: T[],
  nowMs: number = Date.now()
): { due: number; total: number; reviewed: number } {
  return {
    due: cards.filter((c) => c.dueAt <= nowMs).length,
    total: cards.length,
    reviewed: cards.filter((c) => c.reviewCount > 0).length,
  };
}

// ─── localStorage-based functions (legacy, kept for backwards compat) ──────

const STORAGE_KEY = "ugent_review_cards";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function loadCards(): Record<string, ReviewCard> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCards(cards: Record<string, ReviewCard>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function syncBookmarks(
  bookmarks: Array<{ _id: string; question: string; answer: string }>
): ReviewCard[] {
  const cards = loadCards();
  const bookmarkIds = new Set(bookmarks.map((b) => b._id));

  for (const bm of bookmarks) {
    if (!cards[bm._id]) {
      cards[bm._id] = {
        bookmarkId: bm._id,
        question: bm.question,
        answer: bm.answer,
        dueAt: new Date().toISOString(),
        intervalStep: 0,
        reviewCount: 0,
      };
    } else {
      cards[bm._id].question = bm.question;
      cards[bm._id].answer = bm.answer;
    }
  }

  for (const id of Object.keys(cards)) {
    if (!bookmarkIds.has(id)) {
      delete cards[id];
    }
  }

  saveCards(cards);
  return Object.values(cards);
}

export function getDueCards(allCards: ReviewCard[]): ReviewCard[] {
  const now = new Date().toISOString();
  return allCards
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function rateCard(bookmarkId: string, difficulty: Difficulty): ReviewCard | null {
  const cards = loadCards();
  const card = cards[bookmarkId];
  if (!card) return null;

  card.intervalStep = calculateNextStep(card.intervalStep, difficulty);
  card.dueAt = daysFromNow(INTERVALS_DAYS[card.intervalStep]);
  card.reviewCount += 1;

  cards[bookmarkId] = card;
  saveCards(cards);
  return card;
}

export function getDeckStats(allCards: ReviewCard[]) {
  const now = new Date().toISOString();
  const due = allCards.filter((c) => c.dueAt <= now).length;
  const total = allCards.length;
  const reviewed = allCards.filter((c) => c.reviewCount > 0).length;
  return { due, total, reviewed };
}
