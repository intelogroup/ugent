"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2, MessageSquare } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BookmarksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const bookmarks = useQuery(
    api.bookmarks.listBookmarks,
    isAuthenticated ? { limit: 100 } : "skip"
  );
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  if (!isAuthenticated || bookmarks === undefined) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Bookmark className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-semibold">Saved Answers</h1>
        {bookmarks.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {bookmarks.length} saved
          </span>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <Bookmark className="h-10 w-10 opacity-20" />
          <p className="text-sm">No saved answers yet.</p>
          <p className="text-xs opacity-60">
            Tap the bookmark icon on any answer in chat to save it here.
          </p>
          <button
            onClick={() => router.push("/chat")}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Go to chat
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(bookmarks as Array<{
            _id: Id<"messages">;
            messageId: Id<"messages">;
            threadId: Id<"threads">;
            question?: string;
            answer: string;
            createdAt: number;
          }>).map((bm) => (
            <div
              key={bm._id}
              className="group rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-2"
            >
              {bm.question && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  <span className="font-medium">Q:</span> {bm.question}
                </p>
              )}
              <p className="text-sm text-foreground leading-relaxed line-clamp-4">
                {bm.answer}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(bm.createdAt)}
                </span>
                <button
                  onClick={() =>
                    router.push(`/chat?thread=${bm.threadId}`)
                  }
                  className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Open thread"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  View thread
                </button>
                <button
                  onClick={() =>
                    toggleBookmark({ messageId: bm.messageId })
                  }
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remove bookmark"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
