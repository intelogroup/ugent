"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Settings, Monitor, SquarePen } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
}

export function Drawer({ isOpen, onClose, onNewChat }: DrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 z-[70] h-full w-4/5 max-w-sm bg-background border-r shadow-2xl flex flex-col"
          >
            <div className="flex h-14 items-center justify-between px-4 border-b">
              <span className="font-bold text-lg tracking-tight">UGent MedBot</span>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
              {/* New Chat */}
              <button
                onClick={onNewChat}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
              >
                <SquarePen className="h-4 w-4" />
                <span>New Chat</span>
              </button>

              {/* Chat History */}
              <section>
                <h3 className="px-2 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Chat History
                </h3>
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                  <p className="text-xs text-center opacity-50">
                    No saved chats yet
                  </p>
                </div>
              </section>

              {/* Settings */}
              <section>
                <h3 className="px-2 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Settings
                </h3>
                <div className="space-y-1">
                  <div className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground rounded-lg">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span>Model: GPT-4o</span>
                  </div>
                  <div className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground rounded-lg">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Knowledge: First Aid + Pathoma</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="p-4 border-t text-center">
              <p className="text-xs text-muted-foreground italic">Powered by Pathoma & First Aid</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
