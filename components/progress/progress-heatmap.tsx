"use client";

import React, { useState } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BOOKS } from "@/lib/chapters";

type HeatmapEntry = {
  bookSlug: string;
  bookName: string;
  chapterNumber: number;
  chapterTitle: string;
  threadCount: number;
  messageCount: number;
  confidenceRating: number | null;
};

/** Map a message count to a heat intensity 0–4 */
function heatLevel(messageCount: number): 0 | 1 | 2 | 3 | 4 {
  if (messageCount === 0) return 0;
  if (messageCount < 5) return 1;
  if (messageCount < 15) return 2;
  if (messageCount < 30) return 3;
  return 4;
}

const HEAT_CLASSES: Record<number, string> = {
  0: "bg-secondary/40 dark:bg-secondary/20",
  1: "bg-blue-100 dark:bg-blue-950",
  2: "bg-blue-300 dark:bg-blue-700",
  3: "bg-blue-500 dark:bg-blue-500",
  4: "bg-blue-700 dark:bg-blue-300",
};

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "No idea",
  2: "Shaky",
  3: "Okay",
  4: "Good",
  5: "Mastered",
};

const CONFIDENCE_COLOR: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-lime-500",
  5: "text-green-500",
};

function ChapterCell({ entry }: { entry: HeatmapEntry }) {
  const [tooltip, setTooltip] = useState(false);
  const level = heatLevel(entry.messageCount);

  return (
    <div className="relative group">
      <button
        className={`w-full text-left px-3 py-2 rounded-lg border border-transparent transition-all hover:border-border ${HEAT_CLASSES[level]}`}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        onFocus={() => setTooltip(true)}
        onBlur={() => setTooltip(false)}
        aria-label={`${entry.chapterTitle}: ${entry.messageCount} messages`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate">
            Ch. {entry.chapterNumber} — {entry.chapterTitle}
          </span>
          {entry.confidenceRating !== null && (
            <span
              className={`text-[10px] font-semibold shrink-0 ${CONFIDENCE_COLOR[entry.confidenceRating]}`}
            >
              {CONFIDENCE_LABELS[entry.confidenceRating]}
            </span>
          )}
        </div>
        {entry.messageCount > 0 && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {entry.messageCount} msg{entry.messageCount !== 1 ? "s" : ""} · {entry.threadCount} session
            {entry.threadCount !== 1 ? "s" : ""}
          </div>
        )}
      </button>

      {tooltip && entry.messageCount > 0 && (
        <div className="absolute z-50 left-0 bottom-full mb-1 w-56 bg-popover border rounded-lg shadow-lg p-2 text-xs pointer-events-none">
          <p className="font-semibold mb-1">{entry.chapterTitle}</p>
          <p className="text-muted-foreground">
            {entry.messageCount} messages across {entry.threadCount} study session
            {entry.threadCount !== 1 ? "s" : ""}
          </p>
          {entry.confidenceRating !== null && (
            <p className={`mt-1 font-medium ${CONFIDENCE_COLOR[entry.confidenceRating]}`}>
              Confidence: {CONFIDENCE_LABELS[entry.confidenceRating]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <div
          key={level}
          className={`w-4 h-4 rounded-sm ${HEAT_CLASSES[level]} border border-border/30`}
          title={level === 0 ? "No activity" : `Level ${level}`}
        />
      ))}
      <span>More</span>
    </div>
  );
}

export function ProgressHeatmap() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const data = useQuery(api.progressHeatmap.getHeatmapData, currentUser?._id ? {} : "skip");
  const [activeBook, setActiveBook] = useState<string>(BOOKS[0].slug);

  if (data === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 bg-secondary/50 rounded animate-pulse" />
        <div className="grid gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No study activity yet. Start a chapter to see your progress.
      </div>
    );
  }

  const booksInData = BOOKS.filter((b) => data.some((d) => d.bookSlug === b.slug));
  const bookData = data.filter((d) => d.bookSlug === activeBook);

  return (
    <div className="space-y-4">
      {/* Book tabs */}
      <div className="flex gap-1 border-b">
        {booksInData.map((book) => (
          <button
            key={book.slug}
            onClick={() => setActiveBook(book.slug)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              activeBook === book.slug
                ? "bg-background border-x border-t text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {book.name}
          </button>
        ))}
      </div>

      {/* Chapter list */}
      <div className="grid gap-1">
        {bookData.map((entry) => (
          <ChapterCell key={`${entry.bookSlug}:${entry.chapterNumber}`} entry={entry} />
        ))}
      </div>

      {/* Legend */}
      <HeatLegend />
    </div>
  );
}
