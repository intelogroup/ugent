/**
 * Simple SM-2-inspired spaced repetition engine.
 * Review state is persisted in localStorage (no schema changes needed).
 *
 * Intervals (in days): 1 → 3 → 7 → 14 → 30  (capped)
 * Difficulty ratings: "again" resets to day 1, "hard" keeps interval,
 * "good" advances one step, "easy" advances two steps.
 */

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

const INTERVALS_DAYS = [1, 3, 7, 14, 30];
const STORAGE_KEY = "ugent_review_cards";

export type Difficulty = "again" | "hard" | "good" | "easy";

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

/**
 * Sync bookmarks from Convex with the local review deck.
 * New bookmarks get added with dueAt = now (immediately reviewable).
 * Deleted bookmarks get removed.
 */
export function syncBookmarks(
  bookmarks: Array<{ _id: string; question: string; answer: string }>
): ReviewCard[] {
  const cards = loadCards();
  const bookmarkIds = new Set(bookmarks.map((b) => b._id));

  // Add new bookmarks
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
      // Update question/answer snapshot in case bookmark was re-created
      cards[bm._id].question = bm.question;
      cards[bm._id].answer = bm.answer;
    }
  }

  // Remove cards whose bookmarks no longer exist
  for (const id of Object.keys(cards)) {
    if (!bookmarkIds.has(id)) {
      delete cards[id];
    }
  }

  saveCards(cards);
  return Object.values(cards);
}

/**
 * Get cards that are due for review (dueAt <= now).
 */
export function getDueCards(allCards: ReviewCard[]): ReviewCard[] {
  const now = new Date().toISOString();
  return allCards
    .filter((c) => c.dueAt <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/**
 * Rate a card and update its schedule.
 */
export function rateCard(bookmarkId: string, difficulty: Difficulty): ReviewCard | null {
  const cards = loadCards();
  const card = cards[bookmarkId];
  if (!card) return null;

  let nextStep = card.intervalStep;

  switch (difficulty) {
    case "again":
      nextStep = 0;
      break;
    case "hard":
      // stay at current step
      break;
    case "good":
      nextStep = Math.min(nextStep + 1, INTERVALS_DAYS.length - 1);
      break;
    case "easy":
      nextStep = Math.min(nextStep + 2, INTERVALS_DAYS.length - 1);
      break;
  }

  card.intervalStep = nextStep;
  card.dueAt = daysFromNow(INTERVALS_DAYS[nextStep]);
  card.reviewCount += 1;

  cards[bookmarkId] = card;
  saveCards(cards);
  return card;
}

/**
 * Get a summary of the deck state.
 */
export function getDeckStats(allCards: ReviewCard[]) {
  const now = new Date().toISOString();
  const due = allCards.filter((c) => c.dueAt <= now).length;
  const total = allCards.length;
  const reviewed = allCards.filter((c) => c.reviewCount > 0).length;
  return { due, total, reviewed };
}
