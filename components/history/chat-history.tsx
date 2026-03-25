"use client";

import React from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import {
  MessageSquare,
  Clock,
  BookOpen,
  ArrowLeft,
  Bot,
} from "lucide-react";
import { getChapterLabel, type ChapterScope } from "@/lib/chapters";
import type { Id } from "@/convex/_generated/dataModel";

interface ChatHistoryProps {
  onSelectThread: (threadId: Id<"threads">) => void;
  onBack: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ChatHistory({ onSelectThread, onBack }: ChatHistoryProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const currentUser = useQuery(api.users.getCurrentUser);
  const threads = useQuery(
    api.threads.listRecentThreadsWithPreview,
    currentUser?._id ? { userId: currentUser._id, limit: 50 } : "skip"
  );

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-bold tracking-tight">Chat History</h1>
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {threads === undefined ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs opacity-70 mt-1">
              Start a chat to see your history here
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const chapterScope = (thread as any).chapterScope as
              | ChapterScope
              | undefined;
            const label = chapterScope
              ? getChapterLabel(chapterScope)
              : null;

            return (
              <button
                key={thread._id}
                onClick={() => onSelectThread(thread._id as Id<"threads">)}
                className="w-full flex items-start gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all text-left group"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 mt-0.5">
                  {chapterScope ? (
                    <BookOpen className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {thread.title || label || "Chat conversation"}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTimeAgo(thread.updatedAt)}
                    </span>
                  </div>
                  {label && !thread.title && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                      {label}
                    </p>
                  )}
                  {thread.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {thread.lastMessage.role === "assistant"
                        ? "Bot: "
                        : "You: "}
                      {thread.lastMessage.content}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {thread.messageCount} messages
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
