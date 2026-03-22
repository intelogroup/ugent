"use client";

import React, { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const CONFIDENCE_LABELS = [
  { value: 1, label: "No idea", color: "bg-red-500" },
  { value: 2, label: "Weak", color: "bg-orange-500" },
  { value: 3, label: "Okay", color: "bg-yellow-500" },
  { value: 4, label: "Good", color: "bg-lime-500" },
  { value: 5, label: "Mastered", color: "bg-green-500" },
];

export const CONFIDENCE_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
};

export const CONFIDENCE_BG_COLORS: Record<number, string> = {
  1: "bg-red-100 dark:bg-red-950/30",
  2: "bg-orange-100 dark:bg-orange-950/30",
  3: "bg-yellow-100 dark:bg-yellow-950/30",
  4: "bg-lime-100 dark:bg-lime-950/30",
  5: "bg-green-100 dark:bg-green-950/30",
};

interface ConfidenceRatingProps {
  bookSlug: string;
  chapterNumber: number;
  currentRating?: number;
  /** Compact mode — show only dots, no labels */
  compact?: boolean;
}

export function ConfidenceRating({
  bookSlug,
  chapterNumber,
  currentRating,
  compact = false,
}: ConfidenceRatingProps) {
  const setRating = useMutation(api.confidenceRatings.setRating);

  const handleRate = useCallback(
    async (rating: number) => {
      await setRating({ bookSlug, chapterNumber, rating });
    },
    [bookSlug, chapterNumber, setRating]
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Confidence rating">
        {CONFIDENCE_LABELS.map(({ value, color, label }) => (
          <button
            key={value}
            onClick={(e) => {
              e.stopPropagation();
              handleRate(value);
            }}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              currentRating && currentRating >= value
                ? color
                : "bg-gray-200 dark:bg-gray-700"
            } hover:scale-125`}
            aria-label={label}
            title={label}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5" role="group" aria-label="Confidence rating">
        {CONFIDENCE_LABELS.map(({ value, color, label }) => (
          <button
            key={value}
            onClick={(e) => {
              e.stopPropagation();
              handleRate(value);
            }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all ${
              currentRating === value
                ? `${CONFIDENCE_BG_COLORS[value]} ring-1 ring-current ${CONFIDENCE_COLORS[value]}`
                : "hover:bg-secondary"
            }`}
            aria-label={label}
            title={label}
          >
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                currentRating && currentRating >= value
                  ? color
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Small badge showing the current confidence level for a chapter.
 * Used inline in chapter lists.
 */
export function ConfidenceBadge({ rating }: { rating?: number }) {
  if (!rating) return null;
  const label = CONFIDENCE_LABELS.find((l) => l.value === rating);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_BG_COLORS[rating]} ${CONFIDENCE_COLORS[rating]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${label.color}`} />
      {label.label}
    </span>
  );
}
