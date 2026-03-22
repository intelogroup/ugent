/**
 * Shared chapter data for First Aid and Pathoma.
 * Used by browse page, chapter navigator sidebar, and chat scoping.
 */

export interface Chapter {
  number: number;
  title: string;
}

export interface Book {
  name: string;
  slug: string;
  /** Pinecone namespace used for retrieval */
  namespace: string;
  chapters: Chapter[];
}

export const PATHOMA_CHAPTERS: Chapter[] = [
  { number: 1, title: "Growth Adaptations, Cellular Injury, and Cell Death" },
  { number: 2, title: "Inflammation, Inflammatory Disorders, and Wound Healing" },
  { number: 3, title: "Principles of Neoplasia" },
  { number: 4, title: "Hemostasis and Related Disorders" },
  { number: 5, title: "Red Blood Cell Disorders" },
  { number: 6, title: "White Blood Cell Disorders" },
  { number: 7, title: "Vascular Pathology" },
  { number: 8, title: "Cardiac Pathology" },
  { number: 9, title: "Respiratory Tract Pathology" },
  { number: 10, title: "Gastrointestinal Pathology" },
  { number: 11, title: "Exocrine Pancreas, Gallbladder, and Liver Pathology" },
  { number: 12, title: "Kidney and Urinary Tract Pathology" },
  { number: 13, title: "Female Genital System and Gestational Pathology" },
  { number: 14, title: "Male Genital System Pathology" },
  { number: 15, title: "Endocrine Pathology" },
  { number: 16, title: "Breast Pathology" },
  { number: 17, title: "Central Nervous System Pathology" },
  { number: 18, title: "Musculoskeletal Pathology" },
  { number: 19, title: "Skin Pathology" },
];

export const FIRST_AID_CHAPTERS: Chapter[] = [
  { number: 1, title: "Section I Guide" },
  { number: 2, title: "Biochemistry" },
  { number: 3, title: "Immunology" },
  { number: 4, title: "Microbiology" },
  { number: 5, title: "Pathology" },
  { number: 6, title: "Pharmacology" },
  { number: 7, title: "Public Health Sciences" },
  { number: 8, title: "Cardiovascular" },
  { number: 9, title: "Endocrine" },
  { number: 10, title: "Gastrointestinal" },
  { number: 11, title: "Hematology and Oncology" },
  { number: 12, title: "Musculoskeletal" },
  { number: 13, title: "Neurology" },
  { number: 14, title: "Psychiatry" },
  { number: 15, title: "Renal" },
  { number: 16, title: "Reproductive" },
  { number: 17, title: "Respiratory" },
];

export const BOOKS: Book[] = [
  {
    name: "Pathoma (2021)",
    slug: "pathoma",
    namespace: "pathoma-2021",
    chapters: PATHOMA_CHAPTERS,
  },
  {
    name: "First Aid (2023)",
    slug: "first-aid",
    namespace: "first-aid-2023",
    chapters: FIRST_AID_CHAPTERS,
  },
];

/**
 * Serializable chapter scope for storing in threads and passing via URL params.
 */
export interface ChapterScope {
  bookSlug: string;
  chapterNumber: number;
}

/**
 * Get the display label for a chapter scope (e.g., "Pathoma Ch. 3 — Principles of Neoplasia").
 */
export function getChapterLabel(scope: ChapterScope): string {
  const book = BOOKS.find((b) => b.slug === scope.bookSlug);
  if (!book) return "";
  const chapter = book.chapters.find((c) => c.number === scope.chapterNumber);
  if (!chapter) return "";
  const bookShort = scope.bookSlug === "pathoma" ? "Pathoma" : "First Aid";
  return `${bookShort} Ch. ${chapter.number} — ${chapter.title}`;
}

/**
 * Build a system-context prefix for scoping questions to a specific chapter.
 * This is prepended to the user's query so the RAG pipeline focuses retrieval.
 */
export function buildChapterPromptPrefix(scope: ChapterScope): string {
  const book = BOOKS.find((b) => b.slug === scope.bookSlug);
  if (!book) return "";
  const chapter = book.chapters.find((c) => c.number === scope.chapterNumber);
  if (!chapter) return "";
  const bookName = scope.bookSlug === "pathoma" ? "Pathoma" : "First Aid";
  return `[Context: ${bookName} Chapter ${chapter.number} — ${chapter.title}] `;
}
