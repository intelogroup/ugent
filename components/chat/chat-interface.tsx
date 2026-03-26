'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import { useQuery, useMutation } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useSearchParams } from 'next/navigation';
import { Bot, Sparkles, BookOpen } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { InputBar } from './input-bar';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  type ChapterScope,
  getChapterLabel,
  buildChapterPromptPrefix,
} from '@/lib/chapters';

const STARTER_PROMPTS = [
  "Nephritic vs Nephrotic syndrome",
  "Signs of Hyperkalemia",
  "Type II Hypersensitivity examples"
];

interface ChatInterfaceProps {
  /** Resume an existing thread (from chat history) */
  resumeThreadId?: Id<"threads"> | null;
  /** Scope chat to a specific chapter (from chapter navigator) */
  chapterScope?: ChapterScope | null;
  /** Callback when a new thread is created (so parent can track state) */
  onThreadCreated?: (threadId: Id<"threads">) => void;
}

export function ChatInterface({
  resumeThreadId,
  chapterScope,
  onThreadCreated,
}: ChatInterfaceProps = {}) {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const currentUser = useQuery(api.users.getCurrentUser);
  const getOrCreateThread = useMutation(api.threads.getOrCreateWebThread);
  const createChapterThread = useMutation(api.threads.createChapterThread);
  const addMessage = useMutation(api.messages.addMessage);
  const searchParams = useSearchParams();

  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null);
  const [initialPromptSent, setInitialPromptSent] = useState(false);

  // If resuming a thread, use that directly
  useEffect(() => {
    if (resumeThreadId) {
      setThreadId(resumeThreadId);
      setInitialPromptSent(true); // Don't auto-send prompt for resumed threads
    }
  }, [resumeThreadId]);

  // Create/get thread once user is known (only if not resuming)
  useEffect(() => {
    if (resumeThreadId) return; // Skip if resuming
    if (!currentUser?.tokenIdentifier || threadId) return;

    if (chapterScope) {
      // Create a chapter-scoped thread
      const label = getChapterLabel(chapterScope);
      createChapterThread({
        userId: currentUser.tokenIdentifier,
        chapterScope,
        title: label,
      }).then((id) => {
        setThreadId(id);
        onThreadCreated?.(id);
      });
    } else {
      getOrCreateThread({ userId: currentUser.tokenIdentifier }).then((id) => {
        setThreadId(id);
        onThreadCreated?.(id);
      });
    }
  }, [currentUser?.tokenIdentifier, getOrCreateThread, createChapterThread, threadId, chapterScope, resumeThreadId, onThreadCreated]);

  // Load persisted history — skip until threadId is resolved
  const persistedMessages = useQuery(
    api.messages.listByThread,
    threadId ? { threadId } : "skip"
  );

  // Block render until auth + thread + history all ready
  const ready = isAuthenticated && currentUser && threadId && persistedMessages !== undefined;

  const initialMessages = persistedMessages?.map((m) => ({
    id: m._id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    annotations: m.imageAnnotations,
  })) ?? [];

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    initialMessages,
    onFinish: async (message) => {
      if (!threadId) return;
      await addMessage({
        threadId,
        role: 'assistant',
        content: typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
        imageAnnotations: (message.annotations as any[]) ?? undefined,
      });
    },
  });

  // Auto-send prompt from URL query param (e.g., from browse page)
  const promptParam = searchParams?.get("prompt");
  useEffect(() => {
    if (promptParam && threadId && !initialPromptSent && messages.length === 0) {
      setInitialPromptSent(true);
      addMessage({ threadId, role: "user", content: promptParam });
      append({ role: "user", content: promptParam });
    }
  }, [promptParam, threadId, initialPromptSent, messages.length, addMessage, append]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmitWithPersist = async (e: React.FormEvent) => {
    if (!threadId || !input.trim()) return;
    // Prepend chapter context if scoped, so RAG retrieval focuses correctly
    const finalContent = chapterScope
      ? buildChapterPromptPrefix(chapterScope) + input
      : input;
    await addMessage({ threadId, role: 'user', content: finalContent });
    handleSubmit(e);
  };

  const onStarterPromptClick = async (prompt: string) => {
    const finalContent = chapterScope
      ? buildChapterPromptPrefix(chapterScope) + prompt
      : prompt;
    if (threadId) {
      await addMessage({ threadId, role: 'user', content: finalContent });
    }
    append({ role: 'user', content: finalContent });
  };

  // Chapter-specific starter prompts
  const chapterLabel = chapterScope ? getChapterLabel(chapterScope) : null;
  const chapterStarters = chapterScope
    ? [
        `What are the key concepts in this chapter?`,
        `What are the high-yield topics for Step 1?`,
        `Summarize the main pathology mechanisms`,
      ]
    : null;

  // Show nothing until fully ready
  if (!ready) return null;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Chapter scope badge */}
      {chapterLabel && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {chapterLabel}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-6 animate-in fade-in duration-700">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-sm border border-blue-50">
              <Bot className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {chapterLabel ? `Study: ${chapterLabel}` : "How can I help you?"}
            </h1>
            <p className="text-gray-500 mb-10 max-w-xs text-[15px] leading-relaxed">
              {chapterLabel
                ? "Ask questions about this chapter. I'll focus my answers on the relevant material."
                : "I'm your Step 1 study assistant, trained on Pathoma and First Aid."}
            </p>
            <div className="grid gap-3 w-full max-w-sm">
              {(chapterStarters ?? STARTER_PROMPTS).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onStarterPromptClick(prompt)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl text-left text-[15px] font-medium text-gray-700 transition-all flex items-center justify-between group"
                >
                  <span>{prompt}</span>
                  <Sparkles className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex w-full mb-6 justify-start animate-in fade-in duration-300">
                <div className="flex max-w-[85%] md:max-w-[80%] gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
                      <Bot className="w-6 h-6 animate-pulse" />
                    </div>
                  </div>
                  <div className="p-3.5 px-4 bg-gray-50 rounded-2xl flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <div className="bg-white">
        <InputBar
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmitWithPersist}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
