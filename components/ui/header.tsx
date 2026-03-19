"use client";

import { Menu, Bot, SquarePen } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
  onNewChat?: () => void;
}

export function Header({ onMenuClick, onNewChat }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md dark:bg-black/80 dark:border-gray-800">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 font-semibold text-lg text-blue-600 dark:text-blue-400">
            <Bot className="h-6 w-6" />
            <span className="hidden sm:inline">U-Gent MedBot</span>
            <span className="inline sm:hidden">U-Gent</span>
          </div>
        </div>
        
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-800 transition-colors"
          aria-label="New Chat"
        >
          <SquarePen className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}
