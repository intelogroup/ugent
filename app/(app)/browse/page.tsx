"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConfidenceRating, ConfidenceBadge } from "@/components/chapters/confidence-rating";
import {
  Search,
  BookOpen,
  Heart,
  Brain,
  Stethoscope,
  Bone,
  Baby,
  Eye,
  Droplets,
  Wind,
  Pill,
  Shield,
  Bug,
  FlaskConical,
  Activity,
  ChevronRight,
} from "lucide-react";

// ─── Chapter data from pinecone.ts ──────────────────────────────────────────

interface Chapter {
  number: number;
  title: string;
  icon: React.ReactNode;
}

interface BookSection {
  book: string;
  bookSlug: string;
  chapters: Chapter[];
}

const ICON_CLASS = "h-4 w-4";

const PATHOMA_CHAPTERS: Chapter[] = [
  { number: 1, title: "Growth Adaptations, Cellular Injury, and Cell Death", icon: <Activity className={ICON_CLASS} /> },
  { number: 2, title: "Inflammation, Inflammatory Disorders, and Wound Healing", icon: <Shield className={ICON_CLASS} /> },
  { number: 3, title: "Principles of Neoplasia", icon: <FlaskConical className={ICON_CLASS} /> },
  { number: 4, title: "Hemostasis and Related Disorders", icon: <Droplets className={ICON_CLASS} /> },
  { number: 5, title: "Red Blood Cell Disorders", icon: <Droplets className={ICON_CLASS} /> },
  { number: 6, title: "White Blood Cell Disorders", icon: <Droplets className={ICON_CLASS} /> },
  { number: 7, title: "Vascular Pathology", icon: <Heart className={ICON_CLASS} /> },
  { number: 8, title: "Cardiac Pathology", icon: <Heart className={ICON_CLASS} /> },
  { number: 9, title: "Respiratory Tract Pathology", icon: <Wind className={ICON_CLASS} /> },
  { number: 10, title: "Gastrointestinal Pathology", icon: <Stethoscope className={ICON_CLASS} /> },
  { number: 11, title: "Exocrine Pancreas, Gallbladder, and Liver Pathology", icon: <Stethoscope className={ICON_CLASS} /> },
  { number: 12, title: "Kidney and Urinary Tract Pathology", icon: <Droplets className={ICON_CLASS} /> },
  { number: 13, title: "Female Genital System and Gestational Pathology", icon: <Baby className={ICON_CLASS} /> },
  { number: 14, title: "Male Genital System Pathology", icon: <Baby className={ICON_CLASS} /> },
  { number: 15, title: "Endocrine Pathology", icon: <Pill className={ICON_CLASS} /> },
  { number: 16, title: "Breast Pathology", icon: <Stethoscope className={ICON_CLASS} /> },
  { number: 17, title: "Central Nervous System Pathology", icon: <Brain className={ICON_CLASS} /> },
  { number: 18, title: "Musculoskeletal Pathology", icon: <Bone className={ICON_CLASS} /> },
  { number: 19, title: "Skin Pathology", icon: <Eye className={ICON_CLASS} /> },
];

const FIRST_AID_CHAPTERS: Chapter[] = [
  { number: 1, title: "Section I Guide", icon: <BookOpen className={ICON_CLASS} /> },
  { number: 2, title: "Biochemistry", icon: <FlaskConical className={ICON_CLASS} /> },
  { number: 3, title: "Immunology", icon: <Shield className={ICON_CLASS} /> },
  { number: 4, title: "Microbiology", icon: <Bug className={ICON_CLASS} /> },
  { number: 5, title: "Pathology", icon: <Activity className={ICON_CLASS} /> },
  { number: 6, title: "Pharmacology", icon: <Pill className={ICON_CLASS} /> },
  { number: 7, title: "Public Health Sciences", icon: <Stethoscope className={ICON_CLASS} /> },
  { number: 8, title: "Cardiovascular", icon: <Heart className={ICON_CLASS} /> },
  { number: 9, title: "Endocrine", icon: <Pill className={ICON_CLASS} /> },
  { number: 10, title: "Gastrointestinal", icon: <Stethoscope className={ICON_CLASS} /> },
  { number: 11, title: "Hematology and Oncology", icon: <Droplets className={ICON_CLASS} /> },
  { number: 12, title: "Musculoskeletal", icon: <Bone className={ICON_CLASS} /> },
  { number: 13, title: "Neurology", icon: <Brain className={ICON_CLASS} /> },
  { number: 14, title: "Psychiatry", icon: <Brain className={ICON_CLASS} /> },
  { number: 15, title: "Renal", icon: <Droplets className={ICON_CLASS} /> },
  { number: 16, title: "Reproductive", icon: <Baby className={ICON_CLASS} /> },
  { number: 17, title: "Respiratory", icon: <Wind className={ICON_CLASS} /> },
];

const BOOKS: BookSection[] = [
  { book: "Pathoma (2021)", bookSlug: "pathoma", chapters: PATHOMA_CHAPTERS },
  { book: "First Aid (2023)", bookSlug: "first-aid", chapters: FIRST_AID_CHAPTERS },
];

// ─── Organ system grouping ──────────────────────────────────────────────────

interface OrganSystem {
  name: string;
  icon: React.ReactNode;
  keywords: string[];
}

const ORGAN_SYSTEMS: OrganSystem[] = [
  { name: "Cardiovascular", icon: <Heart className="h-5 w-5" />, keywords: ["cardiac", "vascular", "cardiovascular", "hemostasis", "heart"] },
  { name: "Respiratory", icon: <Wind className="h-5 w-5" />, keywords: ["respiratory", "lung"] },
  { name: "Gastrointestinal", icon: <Stethoscope className="h-5 w-5" />, keywords: ["gastrointestinal", "pancreas", "gallbladder", "liver"] },
  { name: "Renal & Urinary", icon: <Droplets className="h-5 w-5" />, keywords: ["kidney", "urinary", "renal"] },
  { name: "Hematology", icon: <Droplets className="h-5 w-5" />, keywords: ["red blood cell", "white blood cell", "hematology", "oncology"] },
  { name: "Neurology", icon: <Brain className="h-5 w-5" />, keywords: ["nervous system", "neurology", "psychiatry"] },
  { name: "Musculoskeletal", icon: <Bone className="h-5 w-5" />, keywords: ["musculoskeletal", "bone", "skin"] },
  { name: "Endocrine", icon: <Pill className="h-5 w-5" />, keywords: ["endocrine", "pharmacology"] },
  { name: "Reproductive", icon: <Baby className="h-5 w-5" />, keywords: ["female genital", "male genital", "reproductive", "gestational", "breast"] },
  { name: "Immunology", icon: <Shield className="h-5 w-5" />, keywords: ["immunology", "inflammation", "inflammatory"] },
  { name: "Microbiology", icon: <Bug className="h-5 w-5" />, keywords: ["microbiology"] },
  { name: "General Principles", icon: <FlaskConical className="h-5 w-5" />, keywords: ["growth adaptations", "neoplasia", "biochemistry", "pathology", "section i", "public health"] },
];

export default function BrowsePage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const confidenceRatings = useQuery(
    api.confidenceRatings.listRatings,
    isAuthenticated ? {} : "skip"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return BOOKS.map((book) => ({
      ...book,
      chapters: book.chapters.filter((ch) => {
        const titleMatch = ch.title.toLowerCase().includes(query);

        const systemMatch = selectedSystem
          ? ORGAN_SYSTEMS.find((s) => s.name === selectedSystem)?.keywords.some((kw) =>
              ch.title.toLowerCase().includes(kw)
            )
          : true;

        return titleMatch && systemMatch;
      }),
    })).filter((book) => book.chapters.length > 0);
  }, [searchQuery, selectedSystem]);

  const startChatAbout = (bookSlug: string, chapterTitle: string) => {
    const prompt = encodeURIComponent(
      `Tell me about ${chapterTitle} from ${bookSlug === "pathoma" ? "Pathoma" : "First Aid"}`
    );
    router.push(`/chat?prompt=${prompt}`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search header */}
      <div className="px-4 pt-4 pb-3 space-y-3 border-b bg-background">
        <h1 className="text-xl font-bold tracking-tight">Browse Topics</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
          />
        </div>

        {/* Organ system chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setSelectedSystem(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedSystem === null
                ? "bg-blue-600 text-white"
                : "bg-secondary text-muted-foreground hover:bg-accent"
            }`}
          >
            All
          </button>
          {ORGAN_SYSTEMS.map((system) => (
            <button
              key={system.name}
              onClick={() =>
                setSelectedSystem(selectedSystem === system.name ? null : system.name)
              }
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedSystem === system.name
                  ? "bg-blue-600 text-white"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              {system.icon}
              {system.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No chapters match your search</p>
          </div>
        ) : (
          filteredBooks.map((book) => (
            <section key={book.bookSlug}>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-3 px-1">
                {book.book}
              </h2>
              <div className="space-y-1.5">
                {book.chapters.map((ch) => {
                  const chapterKey = `${book.bookSlug}:${ch.number}`;
                  const rating = confidenceRatings?.[chapterKey];
                  const isExpanded = expandedChapter === `${book.bookSlug}-${ch.number}`;

                  return (
                    <div key={`${book.bookSlug}-${ch.number}`} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startChatAbout(book.bookSlug, ch.title)}
                          className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl bg-secondary/50 hover:bg-accent border border-transparent hover:border-border transition-all group text-left"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            {ch.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                Ch. {ch.number}: {ch.title}
                              </p>
                              <ConfidenceBadge rating={rating} />
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                        <button
                          onClick={() =>
                            setExpandedChapter(
                              isExpanded ? null : `${book.bookSlug}-${ch.number}`
                            )
                          }
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-secondary transition-colors"
                          aria-label="Rate confidence"
                          title="Rate your confidence"
                        >
                          <ConfidenceRating
                            bookSlug={book.bookSlug}
                            chapterNumber={ch.number}
                            currentRating={rating}
                            compact
                          />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="ml-11 p-2 rounded-lg bg-secondary/30 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-xs text-muted-foreground mb-2">
                            How confident are you with this chapter?
                          </p>
                          <ConfidenceRating
                            bookSlug={book.bookSlug}
                            chapterNumber={ch.number}
                            currentRating={rating}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
