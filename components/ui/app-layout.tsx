"use client";

import React, { useState } from "react";
import { Header } from "./header";
import { Drawer } from "./drawer";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      <Header onMenuClick={toggleDrawer} onNewChat={() => window.location.reload()} />
      <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} />
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
