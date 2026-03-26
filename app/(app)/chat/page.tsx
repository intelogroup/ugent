"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatErrorBoundary } from "@/components/chat/chat-error-boundary";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChapterScope } from "@/lib/chapters";

function ChatPageInner() {
  const searchParams = useSearchParams();

  // Resume an existing thread from chat history
  const threadParam = searchParams?.get("thread");
  const resumeThreadId = threadParam
    ? (threadParam as Id<"threads">)
    : undefined;

  // Chapter scoping from navigator
  const bookSlug = searchParams?.get("book");
  const chapterNum = searchParams?.get("chapter");
  const chapterScope: ChapterScope | undefined =
    bookSlug && chapterNum
      ? { bookSlug, chapterNumber: parseInt(chapterNum, 10) }
      : undefined;

  return (
    <ChatErrorBoundary>
      <ChatInterface
        resumeThreadId={resumeThreadId}
        chapterScope={chapterScope}
      />
    </ChatErrorBoundary>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}
