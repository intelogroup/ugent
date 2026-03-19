'use client';

import { Plus, SendHorizontal } from 'lucide-react';
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface InputBarProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
}

export function InputBar({ input, handleInputChange, handleSubmit, isLoading }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white p-4">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-1.5 bg-white border border-gray-100 rounded-3xl shadow-sm max-w-4xl mx-auto"
      >
        <button
          type="button"
          className="p-3 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about Step 1"
          className="flex-grow py-3 bg-transparent border-none focus:ring-0 text-[16px] resize-none overflow-y-auto"
          style={{ height: 'auto', maxHeight: '200px' }}
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className={cn(
            "p-2.5 rounded-full transition-all shrink-0",
            input.trim() 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95" 
              : "bg-gray-100 text-gray-400"
          )}
        >
          <SendHorizontal className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
