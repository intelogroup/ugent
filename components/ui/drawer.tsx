"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Settings, Moon, Sun, Monitor } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Drawer({ isOpen, onClose }: DrawerProps) {
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
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm sm:hidden"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 z-[70] h-full w-4/5 max-w-sm bg-white dark:bg-zinc-950 border-r dark:border-zinc-800 shadow-2xl flex flex-col"
          >
            <div className="flex h-14 items-center justify-between px-6 border-b dark:border-zinc-800">
              <span className="font-bold text-xl tracking-tight">Navigation</span>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-6">
              {/* Chat History Section */}
              <section>
                <h3 className="px-2 mb-2 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                  Recent History
                </h3>
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors group"
                    >
                      <MessageSquare className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                      <span className="truncate">Medical Query Placeholder {i}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Settings/Model Section */}
              <section>
                <h3 className="px-2 mb-2 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                  Settings
                </h3>
                <div className="space-y-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    <Monitor className="h-4 w-4" />
                    <span>Model: GPT-4o</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                    <Sun className="h-4 w-4" />
                    <span>Theme: Light</span>
                  </button>
                </div>
              </section>
            </div>

            <div className="p-4 border-t dark:border-zinc-800 text-center">
              <p className="text-xs text-gray-400">© 2024 U-Gent Medical Bot</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
