"use client";

import { Menu, Bot, SquarePen } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
  onNewChat?: () => void;
}

export function Header({ onMenuClick, onNewChat }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span>UGent MedBot 3.5</span>
          </div>
        </div>
        
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="New Chat"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
