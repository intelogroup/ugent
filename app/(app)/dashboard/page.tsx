"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import { AuthErrorBoundary } from "@/components/auth/auth-error-boundary";
import { BotConnectModal } from "@/components/onboarding/bot-connect-modal";
import {
  MessageSquare,
  Search,
  SquarePen,
  Clock,
  BookOpen,
  Sparkles,
  ArrowRight,
  Bot,
  Bookmark,
  Send,
} from "lucide-react";

const MEDICAL_FACTS = [
  "The left recurrent laryngeal nerve loops under the aortic arch, making it vulnerable during thoracic surgery.",
  "Berry aneurysms are most commonly found at the junction of the anterior communicating artery with the anterior cerebral artery.",
  "Pheochromocytoma follows the rule of 10s: 10% bilateral, 10% extra-adrenal, 10% malignant, 10% familial.",
  "The most common cause of Cushing syndrome is exogenous corticosteroid use.",
  "Wallenberg syndrome (lateral medullary syndrome) results from occlusion of PICA.",
  "Reed-Sternberg cells are pathognomonic for Hodgkin lymphoma.",
  "The most common site of metastasis for renal cell carcinoma is the lung.",
  "Kartagener syndrome involves situs inversus, bronchiectasis, and sinusitis due to dynein arm defect.",
];

function getDailyFact(): string {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return MEDICAL_FACTS[dayOfYear % MEDICAL_FACTS.length];
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

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const authLoading = false;
  const currentUser = useQuery(api.users.getCurrentUser);
  const recentThreads = useQuery(
    api.threads.listRecentThreadsWithPreview,
    currentUser?._id ? { userId: currentUser._id, limit: 5 } : "skip"
  );
  const bookmarks = useQuery(
    api.bookmarks.listBookmarks,
    currentUser?._id ? { limit: 3 } : "skip"
  );
  const [showBotModal, setShowBotModal] = useState(false);
  const botStatus = useQuery(
    api.botOnboarding.getConnectionStatus,
    currentUser?._id ? {} : "skip"
  );

  const dailyFact = getDailyFact();

  // Auth still hydrating or Convex query still loading
  if (authLoading || currentUser === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Auth resolved but no Convex session — redirect to login
  if (!isAuthenticated || currentUser === null) {
    router.replace("/login");
    return null;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Welcome header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{currentUser?.email ? `, ${currentUser.email.split("@")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your Step 1 study companion
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/chat")}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <SquarePen className="h-6 w-6" />
            <span className="text-sm font-medium">New Chat</span>
          </button>
          <button
            onClick={() => router.push("/browse")}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary hover:bg-accent border border-border transition-colors"
          >
            <Search className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Browse Topics</span>
          </button>
        </div>

        {/* Connect Bot card */}
        <button
          onClick={() => setShowBotModal(true)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Send className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-left">
              {botStatus?.telegramConnected ? (
                <>
                  <p className="text-xs font-medium text-foreground">Telegram connected</p>
                  {botStatus.telegramUsername && (
                    <p className="text-[10px] text-muted-foreground">@{botStatus.telegramUsername}</p>
                  )}
                </>
              ) : (
                <p className="text-xs font-medium text-foreground">Connect Telegram</p>
              )}
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {showBotModal && <BotConnectModal onClose={() => setShowBotModal(false)} />}

        {/* Daily fact */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900 p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Daily Fact
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{dailyFact}</p>
          <button
            onClick={() => {
              const prompt = encodeURIComponent(
                `Explain this in more detail: ${dailyFact}`
              );
              router.push(`/chat?prompt=${prompt}`);
            }}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            Ask me more <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Recent chats */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
              Recent Chats
            </h2>
            {recentThreads && recentThreads.length > 0 && (
              <button
                onClick={() => router.push("/history")}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all
              </button>
            )}
          </div>

          {!recentThreads || recentThreads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No chats yet</p>
                <p className="text-xs opacity-70 mt-0.5">
                  Start a conversation to see it here
                </p>
              </div>
              <button
                onClick={() => router.push("/chat")}
                className="mt-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(recentThreads as Array<{ _id: string; title?: string; updatedAt: number; messageCount: number; platform?: string; lastMessage: { role: string; content: string } | null }>).map((thread) => (
                <button
                  key={thread._id}
                  onClick={() => router.push(`/chat?thread=${thread._id}`)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all text-left group"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {thread.title || "Chat conversation"}
                      </p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimeAgo(thread.updatedAt)}
                      </span>
                    </div>
                    {thread.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {thread.lastMessage.role === "assistant" ? "Bot: " : "You: "}
                        {thread.lastMessage.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {thread.messageCount} messages
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {thread.platform}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Saved bookmarks */}
        {bookmarks && bookmarks.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                Saved
              </h2>
            </div>
            <div className="space-y-2">
              {(bookmarks as Array<{ _id: string; question?: string; answer: string; createdAt: number }>).map((bm) => (
                <button
                  key={bm._id}
                  onClick={() => router.push("/chat")}
                  className="w-full text-left p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 transition-all"
                >
                  {bm.question && (
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      Q: {bm.question}
                    </p>
                  )}
                  <p className="text-sm text-foreground line-clamp-2">
                    {bm.answer}
                  </p>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {formatTimeAgo(bm.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Study resources quick links */}
        <section className="space-y-3 pb-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
            Study Resources
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/browse")}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all"
            >
              <BookOpen className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Pathoma</span>
            </button>
            <button
              onClick={() => router.push("/browse")}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all"
            >
              <BookOpen className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">First Aid</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthErrorBoundary>
      <DashboardContent />
    </AuthErrorBoundary>
  );
}
