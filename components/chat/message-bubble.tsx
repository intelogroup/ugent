'use client';

import { Message } from 'ai';
import { Bot, AlertCircle, Volume2, VolumeX, ImageOff, Bookmark } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { cn } from '@/lib/utils';
import ImageRenderer from '../image-renderer';
import { cleanForSpeech } from '@/lib/clean-for-speech';
import { SourceCitations, type SourceInfo } from './source-citations';
import type { Id } from '@/convex/_generated/dataModel';

interface MessageBubbleProps {
  message: Message;
}

type PlayState = 'idle' | 'speaking';

function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<PlayState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleVoice = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (state === 'speaking') {
      window.speechSynthesis.cancel();
      setState('idle');
      return;
    }

    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utteranceRef.current = utterance;

    utterance.onstart = () => setState('speaking');
    utterance.onend = () => {
      setState('idle');
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setState('idle');
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, [state, text]);

  // Don't render if browser doesn't support Web Speech
  if (typeof window !== 'undefined' && !window.speechSynthesis) return null;

  return (
    <button
      onClick={handleVoice}
      title={state === 'speaking' ? 'Stop' : 'Read aloud'}
      className={cn(
        'mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        state === 'speaking'
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      {state === 'speaking' ? (
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

/**
 * Bookmark button for assistant messages. Stars Q&A pairs for later review.
 */
function BookmarkButton({ messageId }: { messageId: string }) {
  // Only query if the ID looks like a valid Convex ID (not a temp useChat ID)
  const isConvexId = messageId.length > 10 && !messageId.startsWith('msg-');
  const isBookmarked = useQuery(
    api.bookmarks.isBookmarked,
    isConvexId ? { messageId: messageId as Id<"messages"> } : "skip"
  );
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);
  const [isToggling, setIsToggling] = useState(false);

  if (!isConvexId) return null;

  return (
    <button
      onClick={async () => {
        if (isToggling) return;
        setIsToggling(true);
        try {
          await toggleBookmark({ messageId: messageId as Id<"messages"> });
        } finally {
          setIsToggling(false);
        }
      }}
      disabled={isToggling}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark this answer'}
      className={cn(
        'mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        isBookmarked
          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
        isToggling && 'opacity-50'
      )}
    >
      <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
      {isBookmarked && <span>Saved</span>}
    </button>
  );
}

/**
 * Renders an image from annotation data with error fallback for missing files.
 */
function AnnotationImage({ imageId }: { imageId: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-gray-400">
          <ImageOff className="w-6 h-6" />
          <p className="text-xs">Image not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="relative w-full max-w-2xl mx-auto">
        <img
          src={`/extracted_images/images/${imageId}.png`}
          alt="Textbook figure"
          className="w-full h-auto object-contain"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Extract metadata from message annotations (set via data.appendMessageAnnotation on server)
  const annotations = message.annotations as any[] | undefined;
  const contextStatus = annotations?.find((a: any) => a.context_found !== undefined);
  const contextFound = contextStatus ? contextStatus.context_found : true;
  const isContextMissing = !isUser && contextFound === false;
  const imageIds: string[] = contextStatus?.images ?? [];
  const sources: SourceInfo[] = contextStatus?.sources ?? [];

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
              {imageIds.length > 0 && (
                <div className="mt-4 flex flex-col gap-3">
                  {imageIds.map((imageId) => (
                    <AnnotationImage key={imageId} imageId={imageId} />
                  ))}
                </div>
              )}
              {sources.length > 0 && (
                <SourceCitations sources={sources} />
              )}
              <div className="flex items-center gap-1">
                {message.content.length > 20 && (
                  <VoiceButton text={message.content} />
                )}
                <BookmarkButton messageId={message.id} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
