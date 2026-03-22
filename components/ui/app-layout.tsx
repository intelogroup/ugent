"use client";

import React, { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Header } from "./header";
import { Drawer } from "./drawer";
import { ChapterNavigator } from "@/components/chapters/chapter-navigator";
import type { ChapterScope } from "@/lib/chapters";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChapterNavOpen, setIsChapterNavOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const toggleDrawer = () => setIsDrawerOpen((v) => !v);
  const closeDrawer = () => setIsDrawerOpen(false);
  const resetChat = () => {
    closeDrawer();
    setChatKey((k) => k + 1);
  };

  const toggleChapterNav = useCallback(() => {
    setIsChapterNavOpen((v) => !v);
  }, []);

  const handleSelectChapter = useCallback(
    (scope: ChapterScope) => {
      setIsChapterNavOpen(false);
      router.push(`/chat?book=${scope.bookSlug}&chapter=${scope.chapterNumber}`);
      // Force re-mount if already on chat page
      if (pathname === "/chat") {
        setChatKey((k) => k + 1);
      }
    },
    [router, pathname]
  );

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <Header
        onMenuClick={toggleDrawer}
        onNewChat={resetChat}
        onChapterNavToggle={toggleChapterNav}
      />
      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} onNewChat={resetChat} />
      <div className="flex flex-1 overflow-hidden relative">
        <ChapterNavigator
          isOpen={isChapterNavOpen}
          onClose={() => setIsChapterNavOpen(false)}
          onSelectChapter={handleSelectChapter}
        />
        <main className="flex-1 overflow-hidden">
          <div key={chatKey} className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
