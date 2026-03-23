"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, Bot, SquarePen, Home, Search, MessageSquare, Layers, Clock, BookOpen, Sun, Moon, BarChart2, Link2, BrainCircuit } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WhatsAppSubscribe } from "@/components/whatsapp/whatsapp-subscribe";
import { BotConnectModal } from "@/components/onboarding/bot-connect-modal";
import { useTheme } from "@/components/theme-provider";

interface HeaderProps {
  onMenuClick: () => void;
  onNewChat?: () => void;
  onChapterNavToggle?: () => void;
}

export function Header({ onMenuClick, onNewChat, onChapterNavToggle }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showBotConnect, setShowBotConnect] = useState(false);

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
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">UGent MedBot</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/dashboard"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Dashboard"
          >
            <Home className="h-5 w-5" />
          </Link>
          <Link
            href="/browse"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/browse"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Browse Topics"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/chat"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/chat"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Link>
          <Link
            href="/history"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/history"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Chat History"
          >
            <Clock className="h-5 w-5" />
          </Link>
          <Link
            href="/review"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/review"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Review"
          >
            <Layers className="h-5 w-5" />
          </Link>
          <Link
            href="/quiz"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/quiz"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Quick Quiz"
          >
            <BrainCircuit className="h-5 w-5" />
          </Link>
          {onChapterNavToggle && (
            <button
              onClick={onChapterNavToggle}
              className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
              aria-label="Chapter Navigator"
            >
              <BookOpen className="h-5 w-5" />
            </button>
          )}
          <Link
            href="/progress"
            className={`p-2 rounded-lg transition-colors ${
              pathname === "/progress"
                ? "bg-accent text-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
            aria-label="Progress Heatmap"
          >
            <BarChart2 className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setShowBotConnect(true)}
            className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
            aria-label="Connect Bot"
            title="Connect Telegram or WhatsApp"
          >
            <Link2 className="h-5 w-5" />
          </button>
          <WhatsAppSubscribe />
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="New Chat"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </nav>
      </div>
      {showBotConnect && <BotConnectModal onClose={() => setShowBotConnect(false)} />}
    </header>
  );
}
