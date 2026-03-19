'use client';

import React, { useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import ImageRenderer from './image-renderer';
import { cn } from '@/lib/utils'; // Assuming this exists or I'll create it if not. Wait, I should check lib/utils.

const ChatInterface = () => {
  const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading, error } = useChat({
    api: '/api/chat',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white border-x border-gray-100 shadow-sm">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">U-Gent Medical Chatbot</h1>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
            <Bot className="w-12 h-12 mb-4 text-blue-200" />
            <h3 className="text-lg font-medium text-gray-900">Welcome to U-Gent</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">
              Ask any medical question from Pathoma and First Aid.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-4 w-full",
              m.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                m.role === 'user' ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-600"
              )}
            >
              {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            
            <div
              className={cn(
                "max-w-[85%] rounded-2xl p-4 shadow-sm",
                m.role === 'user'
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100"
              )}
            >
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : (
                <ImageRenderer content={m.content} />
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-4 flex-row">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-none p-4 shadow-sm border border-gray-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center border border-red-100">
            An error occurred: {error.message}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <footer className="p-4 bg-white border-t border-gray-100 sticky bottom-0">
        <form onSubmit={handleSubmit} className="relative group">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your medical question..."
            disabled={isLoading}
            className="w-full pl-4 pr-14 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:opacity-50 transition-all shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-2 uppercase tracking-widest font-semibold">
          AI generated content may contain errors. Always consult a physician.
        </p>
      </footer>
    </div>
  );
};

export default ChatInterface;
