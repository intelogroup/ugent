'use client';

import { Message } from 'ai';
import { Bot, AlertCircle, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import ImageRenderer from '../image-renderer';

interface MessageBubbleProps {
  message: Message;
}

type PlayState = 'idle' | 'loading' | 'playing';

function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<PlayState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleVoice = useCallback(async () => {
    // Stop if already playing
    if (state === 'playing') {
      audioRef.current?.pause();
      audioRef.current = null;
      setState('idle');
      return;
    }

    setState('loading');
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setState('idle');
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setState('idle');
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
      setState('playing');
    } catch {
      setState('idle');
    }
  }, [state, text]);

  return (
    <button
      onClick={handleVoice}
      title={state === 'playing' ? 'Stop' : 'Read aloud'}
      className={cn(
        'mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        state === 'playing'
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
        state === 'loading' && 'opacity-60 cursor-wait'
      )}
      disabled={state === 'loading'}
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === 'playing' ? (
        <>
          <VolumeX className="w-3.5 h-3.5" />
          <span>Stop</span>
          <span className="flex gap-0.5 items-end h-3">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-blue-500 rounded-full animate-pulse"
                style={{
                  height: `${6 + i * 3}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </span>
        </>
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Extract context status from message data
  const data = message.data as any[] | undefined;
  const contextStatus = data?.find((d: any) => d.context_found !== undefined);
  const contextFound = contextStatus ? contextStatus.context_found : true;
  const isContextMissing = !isUser && contextFound === false;

  return (
    <div
      className={cn(
        'flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('flex max-w-[85%] md:max-w-[80%]', isUser ? 'flex-row' : 'flex-row gap-3')}>
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-50">
              <Bot className="w-6 h-6" />
            </div>
          </div>
        )}

        <div
          className={cn(
            'text-[16px] leading-relaxed relative',
            isUser
              ? 'bg-[#F3F4F6] text-gray-900 rounded-2xl p-3.5 px-4'
              : 'bg-transparent text-gray-800 py-1.5',
            isContextMissing && 'border-2 border-red-500 rounded-2xl p-4 bg-red-50/30'
          )}
        >
          {isContextMissing && (
            <div className="flex items-center gap-2 mb-3 text-red-600 font-bold text-sm bg-red-100/50 p-2 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4" />
              <span>AI KNOWLEDGE ONLY — NO TEXTBOOK CONTEXT FOUND</span>
            </div>
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <>
              <ImageRenderer content={message.content} />
              {/* Only show voice button once message has fully streamed (>20 chars) */}
              {message.content.length > 20 && (
                <VoiceButton text={message.content} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
