"use client";

import React, { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, XCircle, RotateCcw, Loader2, BrainCircuit } from "lucide-react";

interface MCQOption {
  label: string;
  text: string;
}

interface MCQuestion {
  question: string;
  options: MCQOption[];
  correctLabel: string;
  explanation: string;
}

interface QuickQuizProps {
  /** Free-text topic or chapter title */
  topic: string;
  bookSlug?: string;
  chapterNumber?: number;
  onClose?: () => void;
}

type AnswerState = Record<number, string>; // questionIndex -> chosen label

export function QuickQuiz({ topic, bookSlug, chapterNumber, onClose }: QuickQuizProps) {
  const generateQuiz = useAction(api.quiz.generateQuiz);

  const [questions, setQuestions] = useState<MCQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const start = async () => {
    setLoading(true);
    setError(null);
    setAnswers({});
    setStarted(true);
    try {
      const qs = await generateQuiz({ topic, bookSlug, chapterNumber });
      setQuestions(qs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex: number, label: string) => {
    // Only allow answer if not already answered
    if (answers[qIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: label }));
  };

  const score = questions.length > 0
    ? questions.filter((q, i) => answers[i] === q.correctLabel).length
    : 0;
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;

  const reset = () => {
    setQuestions([]);
    setAnswers({});
    setStarted(false);
    setError(null);
  };

  // ─── Not started yet ──────────────────────────────────────────────────────
  if (!started && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
          <BrainCircuit className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Quick Quiz</h2>
          <p className="text-sm text-muted-foreground mt-1">
            5 multiple-choice questions on<br />
            <span className="font-medium text-foreground">{topic}</span>
          </p>
        </div>
        <button
          onClick={start}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
        >
          Start Quiz
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm">Generating quiz questions…</p>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <XCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-accent transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Quick Quiz</h2>
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{topic}</p>
        </div>
        <div className="flex items-center gap-2">
          {allAnswered && (
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {`${score}/${questions.length}`}
            </span>
          )}
          <button
            onClick={reset}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Restart quiz"
            aria-label="Restart quiz"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const answered = chosen !== undefined;

          return (
            <div key={qi} className="space-y-3">
              {/* Question text */}
              <p className="text-sm font-medium text-foreground leading-relaxed">
                <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">
                  Q{qi + 1}.
                </span>
                {q.question}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const isChosen = chosen === opt.label;
                  const isCorrect = opt.label === q.correctLabel;

                  let optionStyle =
                    "w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all";

                  if (!answered) {
                    optionStyle +=
                      " border-border bg-secondary/40 hover:bg-accent hover:border-blue-400 cursor-pointer";
                  } else if (isCorrect) {
                    optionStyle +=
                      " border-green-500 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300";
                  } else if (isChosen && !isCorrect) {
                    optionStyle +=
                      " border-red-400 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300";
                  } else {
                    optionStyle += " border-border bg-secondary/20 opacity-60";
                  }

                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSelect(qi, opt.label)}
                      disabled={answered}
                      className={optionStyle}
                      aria-pressed={isChosen}
                    >
                      <span className="flex items-start gap-2">
                        <span className="font-bold flex-shrink-0 w-5">{opt.label}.</span>
                        <span className="flex-1">{opt.text}</span>
                        {answered && isCorrect && (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
                        )}
                        {answered && isChosen && !isCorrect && (
                          <XCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation — shown after answering */}
              {answered && (
                <div className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    <span className="font-semibold">Explanation: </span>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Final score */}
        {allAnswered && (
          <div className="pb-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="rounded-2xl bg-secondary/50 border p-5 text-center space-y-3">
              <p className="text-2xl font-bold text-foreground">
                {`${score}/${questions.length}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {score === questions.length
                  ? "Perfect score! Great work."
                  : score >= Math.ceil(questions.length / 2)
                  ? "Good effort! Review the ones you missed."
                  : "Keep studying — you'll get there!"}
              </p>
              <button
                onClick={start}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
