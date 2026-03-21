'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import { useQuery, useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { authClient } from '@/lib/auth-client';
import { Bot, Sparkles } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { InputBar } from './input-bar';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const STARTER_PROMPTS = [
  "Nephritic vs Nephrotic syndrome",
  "Signs of Hyperkalemia",
  "Type II Hypersensitivity examples"
];

export function ChatInterface() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const getOrCreateThread = useMutation(api.threads.getOrCreateWebThread);
  const addMessage = useMutation(api.messages.addMessage);

  const [threadId, setThreadId] = useState<Id<"threads"> | null>(null);

  // Create/get thread once user is known
  useEffect(() => {
    if (currentUser?._id && !threadId) {
      getOrCreateThread({ userId: currentUser._id }).then(setThreadId);
    }
  }, [currentUser?._id, getOrCreateThread, threadId]);

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

  // crossDomainClient stores session in localStorage — pass it to the API route
  // so Next.js can authenticate via the Convex token endpoint.
  const authHeaders = { 'Better-Auth-Cookie': (authClient as any).getCookie?.() ?? '' };

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    headers: authHeaders,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmitWithPersist = async (e: React.FormEvent) => {
    if (!threadId || !input.trim()) return;
    await addMessage({ threadId, role: 'user', content: input });
    handleSubmit(e);
  };

  const onStarterPromptClick = async (prompt: string) => {
    if (threadId) {
      await addMessage({ threadId, role: 'user', content: prompt });
    }
    append({ role: 'user', content: prompt });
  };

  // Show nothing until fully ready
  if (!ready) return null;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center px-6 animate-in fade-in duration-700">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-sm border border-blue-50">
              <Bot className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">How can I help you?</h1>
            <p className="text-gray-500 mb-10 max-w-xs text-[15px] leading-relaxed">
              I'm your Step 1 study assistant, trained on Pathoma and First Aid.
            </p>
            <div className="grid gap-3 w-full max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
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
