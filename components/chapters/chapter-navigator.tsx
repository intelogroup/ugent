"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { BOOKS, type ChapterScope } from "@/lib/chapters";

interface ChapterNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (scope: ChapterScope) => void;
}

export function ChapterNavigator({
  isOpen,
  onClose,
  onSelectChapter,
}: ChapterNavigatorProps) {
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({
    pathoma: true,
    "first-aid": true,
  });
  const [search, setSearch] = useState("");

  const toggleBook = (slug: string) => {
    setExpandedBooks((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const filteredBooks = BOOKS.map((book) => ({
    ...book,
    chapters: book.chapters.filter((ch) =>
      ch.title.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((book) => book.chapters.length > 0);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-14 left-0 bottom-0 z-40 w-72 bg-background border-r transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:z-auto overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold">Chapters</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md lg:hidden"
            aria-label="Close chapter navigator"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chapters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-secondary rounded-lg text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredBooks.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Search className="h-6 w-6 mb-2 opacity-30" />
              <p className="text-xs">No chapters match</p>
            </div>
          ) : (
            filteredBooks.map((book) => (
              <div key={book.slug} className="mb-1">
                {/* Book header */}
                <button
                  onClick={() => toggleBook(book.slug)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent transition-colors"
                >
                  {expandedBooks[book.slug] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {book.name}
                </button>

                {/* Chapter items */}
                {expandedBooks[book.slug] && (
                  <div className="space-y-0.5 px-2">
                    {book.chapters.map((ch) => (
                      <button
                        key={`${book.slug}-${ch.number}`}
                        onClick={() => {
                          onSelectChapter({
                            bookSlug: book.slug,
                            chapterNumber: ch.number,
                          });
                          onClose();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs hover:bg-accent transition-colors group"
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {ch.number}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-foreground">
                          {ch.title}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
