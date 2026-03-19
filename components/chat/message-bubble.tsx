'use client';

import { Message } from 'ai';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageRenderer from '../image-renderer';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        "flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn("flex max-w-[85%] md:max-w-[80%]", isUser ? "flex-row" : "flex-row gap-3")}>
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
              <Bot className="w-6 h-6" />
            </div>
          </div>
        )}
        
        <div
          className={cn(
            "text-[16px] leading-relaxed",
            isUser 
              ? "bg-[#F3F4F6] text-gray-900 rounded-2xl p-3.5 px-4" 
              : "bg-transparent text-gray-800 py-1.5"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ImageRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
