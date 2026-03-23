"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuickQuiz } from "@/components/quiz/quick-quiz";
import { BrainCircuit, ChevronRight } from "lucide-react";

const SUGGESTED_TOPICS = [
  { label: "Cardiac Pathology", bookSlug: "pathoma", chapterNumber: 8 },
  { label: "Red Blood Cell Disorders", bookSlug: "pathoma", chapterNumber: 5 },
  { label: "Respiratory Tract Pathology", bookSlug: "pathoma", chapterNumber: 9 },
  { label: "Biochemistry", bookSlug: "first-aid", chapterNumber: 2 },
  { label: "Microbiology", bookSlug: "first-aid", chapterNumber: 4 },
  { label: "Immunology", bookSlug: "first-aid", chapterNumber: 3 },
];

function QuizPageInner() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") ?? "";
  const initialBook = searchParams.get("book") ?? undefined;
  const initialChapter = searchParams.get("chapter")
    ? parseInt(searchParams.get("chapter")!, 10)
    : undefined;

  const [activeTopic, setActiveTopic] = useState<string>(initialTopic);
  const [activeBook, setActiveBook] = useState<string | undefined>(initialBook);
  const [activeChapter, setActiveChapter] = useState<number | undefined>(initialChapter);
  const [customInput, setCustomInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(!!initialTopic);

  const startCustomQuiz = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setActiveTopic(trimmed);
    setActiveBook(undefined);
    setActiveChapter(undefined);
    setShowQuiz(true);
  };

  if (showQuiz && activeTopic) {
    return (
      <div className="flex flex-col h-full">
        <QuickQuiz
          topic={activeTopic}
          bookSlug={activeBook}
          chapterNumber={activeChapter}
          onClose={() => {
            setShowQuiz(false);
            setActiveTopic("");
            setCustomInput("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b bg-background">
        <div className="flex items-center gap-2 mb-1">
          <BrainCircuit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-xl font-bold tracking-tight">Quick Quiz</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Test your knowledge with 5 AI-generated MCQs
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Custom topic */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Custom Topic
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Myocardial infarction, Type 2 diabetes…"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startCustomQuiz()}
              className="flex-1 px-3 py-2.5 bg-secondary rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
            />
            <button
              onClick={startCustomQuiz}
              disabled={!customInput.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-blue-700 active:scale-95 transition-all"
            >
              Go
            </button>
          </div>
        </section>

        {/* Suggested topics */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Suggested Topics
          </h2>
          <div className="space-y-1.5">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setActiveTopic(t.label);
                  setActiveBook(t.bookSlug);
                  setActiveChapter(t.chapterNumber);
                  setShowQuiz(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all group text-left"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <BrainCircuit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.bookSlug === "pathoma" ? "Pathoma" : "First Aid"} Ch.{" "}
                    {t.chapterNumber}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense>
      <QuizPageInner />
    </Suspense>
  );
}
