"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Layers,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

type Difficulty = "again" | "hard" | "good" | "easy";

const INTERVALS_DAYS = [1, 3, 7, 14, 30];

export default function ReviewPage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();

  // Sync bookmarks into review cards
  const syncFromBookmarks = useMutation(api.reviewCards.syncFromBookmarks);
  const rateCardMutation = useMutation(api.reviewCards.rateCard);

  // Fetch Convex-backed data
  const allCards = useQuery(api.reviewCards.listCards, isAuthenticated ? {} : "skip");
  const dueCards = useQuery(api.reviewCards.listDueCards, isAuthenticated ? {} : "skip");
  const stats = useQuery(api.reviewCards.getDeckStats, isAuthenticated ? {} : "skip");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [synced, setSynced] = useState(false);

  // Sync bookmarks on mount
  useEffect(() => {
    if (isAuthenticated && !synced) {
      syncFromBookmarks({}).then(() => setSynced(true)).catch(() => setSynced(true));
    }
  }, [isAuthenticated, synced, syncFromBookmarks]);

  // Detect session complete
  useEffect(() => {
    if (dueCards && dueCards.length === 0 && synced) {
      setSessionComplete(true);
    }
  }, [dueCards, synced]);

  const currentCard = dueCards?.[currentIndex] ?? null;
  const deckStats = stats ?? { due: 0, total: 0, reviewed: 0 };

  const handleRate = useCallback(
    async (difficulty: Difficulty) => {
      if (!currentCard) return;
      await rateCardMutation({ cardId: currentCard._id, difficulty });

      const nextIndex = currentIndex + 1;
      if (nextIndex >= (dueCards?.length ?? 0)) {
        setSessionComplete(true);
      } else {
        setCurrentIndex(nextIndex);
        setFlipped(false);
      }
    },
    [currentCard, currentIndex, dueCards?.length, rateCardMutation]
  );

  // Empty state — no cards at all
  if (allCards && allCards.length === 0 && synced) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <BookOpen className="h-14 w-14 text-muted-foreground opacity-30 mb-4" />
        <h1 className="text-xl font-bold mb-2">No flashcards yet</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">
          Bookmark Q&A pairs from your chats to build your review deck.
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Start chatting
        </button>
      </div>
    );
  }

  // Session complete
  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">All caught up!</h1>
        <p className="text-sm text-muted-foreground mb-2">
          {deckStats.due === 0
            ? "No cards are due for review right now."
            : `${deckStats.due} card${deckStats.due !== 1 ? "s" : ""} remaining.`}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          {deckStats.total} total cards &middot; {deckStats.reviewed} reviewed at least once
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-colors"
          >
            Back to Chat
          </button>
          <button
            onClick={() => {
              // Re-sync and check for new due cards
              setSynced(false);
              setCurrentIndex(0);
              setFlipped(false);
              setSessionComplete(false);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading review deck...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-3 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg font-bold tracking-tight">Review</h1>
          </div>
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          {currentIndex + 1} / {dueCards?.length ?? 0}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{
            width: `${((currentIndex) / (dueCards?.length ?? 1)) * 100}%`,
          }}
        />
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <button
          onClick={() => setFlipped(!flipped)}
          className="w-full max-w-lg min-h-[280px] perspective-1000"
          aria-label={flipped ? "Show question" : "Show answer"}
        >
          <div
            className={`relative w-full min-h-[280px] transition-all duration-500 transform-style-3d ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            {/* Front — Question */}
            <div className="absolute inset-0 w-full min-h-[280px] backface-hidden rounded-2xl border bg-white dark:bg-card shadow-lg p-6 flex flex-col items-center justify-center text-center">
              <div className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold mb-4 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Question
              </div>
              <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                {currentCard.question || "No question recorded"}
              </p>
              <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
                Tap to reveal <ChevronRight className="h-3 w-3" />
              </p>
            </div>

            {/* Back — Answer */}
            <div className="absolute inset-0 w-full min-h-[280px] [transform:rotateY(180deg)] backface-hidden rounded-2xl border bg-blue-50 dark:bg-blue-950/30 shadow-lg p-6 flex flex-col items-center justify-center text-center overflow-y-auto">
              <div className="text-xs uppercase tracking-wider text-green-600 dark:text-green-400 font-semibold mb-4">
                Answer
              </div>
              <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {currentCard.answer || "No answer recorded"}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Rating buttons — only visible when flipped */}
      {flipped && (
        <div className="px-4 pb-6 pt-2 border-t bg-background animate-in slide-in-from-bottom-4 duration-300">
          <p className="text-center text-xs text-muted-foreground mb-3">
            How well did you know this?
          </p>
          <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
            <button
              onClick={() => handleRate("again")}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">Again</span>
              <span className="text-[10px] text-red-500/70">1 day</span>
            </button>
            <button
              onClick={() => handleRate("hard")}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
            >
              <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Hard</span>
              <span className="text-[10px] text-orange-500/70">
                {INTERVALS_DAYS[currentCard.intervalStep]} day{currentCard.intervalStep > 0 ? "s" : ""}
              </span>
            </button>
            <button
              onClick={() => handleRate("good")}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
            >
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">Good</span>
              <span className="text-[10px] text-green-500/70">
                {INTERVALS_DAYS[Math.min(currentCard.intervalStep + 1, 4)]} days
              </span>
            </button>
            <button
              onClick={() => handleRate("easy")}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
            >
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Easy</span>
              <span className="text-[10px] text-blue-500/70">
                {INTERVALS_DAYS[Math.min(currentCard.intervalStep + 2, 4)]} days
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
