'use client';

import { BookOpen } from 'lucide-react';

export interface SourceInfo {
  book: string;
  chapter: string;
}

interface SourceCitationsProps {
  sources: SourceInfo[];
}

/**
 * Renders deduplicated source citations (book + chapter) beneath an assistant message.
 * Shows which textbook chapters were used to generate the answer.
 */
export function SourceCitations({ sources }: SourceCitationsProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="source-citations">
      {sources.map((source, i) => (
        <span
          key={`${source.book}-${source.chapter}-${i}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
          data-testid="source-citation-badge"
        >
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[200px]">
            {source.book} — {source.chapter}
          </span>
        </span>
      ))}
    </div>
  );
}
