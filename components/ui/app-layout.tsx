"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "./header";
import { Drawer } from "./drawer";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  const toggleDrawer = () => setIsDrawerOpen((v) => !v);
  const closeDrawer = () => setIsDrawerOpen(false);
  const resetChat = () => {
    closeDrawer();
    setChatKey((k) => k + 1);
    router.push('/chat');
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <Header
        onMenuClick={toggleDrawer}
        onNewChat={resetChat}
      />
      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} onNewChat={resetChat} />
      <main className="flex-1 overflow-hidden">
        <div key={chatKey} className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
