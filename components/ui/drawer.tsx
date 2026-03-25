"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import { X, MessageSquare, Settings, Monitor, SquarePen, Home, Search, BookOpen, Layers, ChevronDown, ChevronRight, Bot, Clock, BrainCircuit } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
}

// Chapter data for the outline navigator
const PATHOMA_CHAPTERS = [
  "Growth Adaptations, Cellular Injury, and Cell Death",
  "Inflammation, Inflammatory Disorders, and Wound Healing",
  "Principles of Neoplasia",
  "Hemostasis and Related Disorders",
  "Red Blood Cell Disorders",
  "White Blood Cell Disorders",
  "Vascular Pathology",
  "Cardiac Pathology",
  "Respiratory Tract Pathology",
  "Gastrointestinal Pathology",
  "Exocrine Pancreas, Gallbladder, and Liver Pathology",
  "Kidney and Urinary Tract Pathology",
  "Female Genital System and Gestational Pathology",
  "Male Genital System Pathology",
  "Endocrine Pathology",
  "Breast Pathology",
  "Central Nervous System Pathology",
  "Musculoskeletal Pathology",
  "Skin Pathology",
];

const FIRST_AID_CHAPTERS = [
  "Section I Guide",
  "Biochemistry",
  "Immunology",
  "Microbiology",
  "Pathology",
  "Pharmacology",
  "Public Health Sciences",
  "Cardiovascular",
  "Endocrine",
  "Gastrointestinal",
  "Hematology and Oncology",
  "Musculoskeletal",
  "Neurology",
  "Psychiatry",
  "Renal",
  "Reproductive",
  "Respiratory",
];

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function Drawer({ isOpen, onClose, onNewChat }: DrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const currentUser = useQuery(api.users.getCurrentUser);
  const recentThreads = useQuery(
    api.threads.listRecentThreadsWithPreview,
    currentUser?._id ? { userId: currentUser._id, limit: 8 } : "skip"
  );
  const [pathomaOpen, setPathomaOpen] = useState(false);
  const [firstAidOpen, setFirstAidOpen] = useState(false);

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

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
              {/* Navigation */}
              <section className="space-y-1">
                <button
                  onClick={() => navigateTo("/dashboard")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                >
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => navigateTo("/browse")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span>Browse Topics</span>
                </button>
                <button
                  onClick={() => navigateTo("/review")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                >
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span>Review Cards</span>
                </button>
                <button
                  onClick={() => navigateTo("/quiz")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                >
                  <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                  <span>Quick Quiz</span>
                </button>
                <button
                  onClick={onNewChat}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
                >
                  <SquarePen className="h-4 w-4" />
                  <span>New Chat</span>
                </button>
              </section>

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

              {/* Chapter Outline Navigator */}
              <section>
                <h3 className="px-2 mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Chapter Outlines
                </h3>
                <div className="space-y-1">
                  {/* Pathoma */}
                  <button
                    onClick={() => setPathomaOpen(!pathomaOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">Pathoma (2021)</span>
                    {pathomaOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {pathomaOpen && (
                    <div className="ml-4 space-y-0.5">
                      {PATHOMA_CHAPTERS.map((title, i) => (
                        <button
                          key={`pathoma-${i}`}
                          onClick={() => {
                            onClose();
                            const prompt = encodeURIComponent(
                              `Tell me about ${title} from Pathoma`
                            );
                            router.push(`/chat?prompt=${prompt}`);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors truncate"
                        >
                          Ch. {i + 1}: {title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* First Aid */}
                  <button
                    onClick={() => setFirstAidOpen(!firstAidOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
                  >
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">First Aid (2023)</span>
                    {firstAidOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {firstAidOpen && (
                    <div className="ml-4 space-y-0.5">
                      {FIRST_AID_CHAPTERS.map((title, i) => (
                        <button
                          key={`fa-${i}`}
                          onClick={() => {
                            onClose();
                            const prompt = encodeURIComponent(
                              `Tell me about ${title} from First Aid`
                            );
                            router.push(`/chat?prompt=${prompt}`);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors truncate"
                        >
                          Ch. {i + 1}: {title}
                        </button>
                      ))}
                    </div>
                  )}
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
