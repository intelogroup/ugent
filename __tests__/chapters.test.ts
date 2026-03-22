import { describe, it, expect } from "vitest";
import {
  BOOKS,
  PATHOMA_CHAPTERS,
  FIRST_AID_CHAPTERS,
  getChapterLabel,
  buildChapterPromptPrefix,
  type ChapterScope,
} from "@/lib/chapters";

describe("lib/chapters", () => {
  describe("BOOKS data", () => {
    it("exports two books: Pathoma and First Aid", () => {
      expect(BOOKS).toHaveLength(2);
      expect(BOOKS[0].slug).toBe("pathoma");
      expect(BOOKS[1].slug).toBe("first-aid");
    });

    it("Pathoma has 19 chapters", () => {
      expect(PATHOMA_CHAPTERS).toHaveLength(19);
    });

    it("First Aid has 17 chapters", () => {
      expect(FIRST_AID_CHAPTERS).toHaveLength(17);
    });

    it("chapters have sequential numbers starting from 1", () => {
      PATHOMA_CHAPTERS.forEach((ch, i) => {
        expect(ch.number).toBe(i + 1);
      });
      FIRST_AID_CHAPTERS.forEach((ch, i) => {
        expect(ch.number).toBe(i + 1);
      });
    });

    it("all chapters have non-empty titles", () => {
      [...PATHOMA_CHAPTERS, ...FIRST_AID_CHAPTERS].forEach((ch) => {
        expect(ch.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getChapterLabel", () => {
    it("returns correct label for Pathoma chapter", () => {
      const scope: ChapterScope = { bookSlug: "pathoma", chapterNumber: 3 };
      expect(getChapterLabel(scope)).toBe(
        "Pathoma Ch. 3 — Principles of Neoplasia"
      );
    });

    it("returns correct label for First Aid chapter", () => {
      const scope: ChapterScope = { bookSlug: "first-aid", chapterNumber: 8 };
      expect(getChapterLabel(scope)).toBe("First Aid Ch. 8 — Cardiovascular");
    });

    it("returns empty string for unknown book", () => {
      const scope: ChapterScope = { bookSlug: "unknown", chapterNumber: 1 };
      expect(getChapterLabel(scope)).toBe("");
    });

    it("returns empty string for out-of-range chapter", () => {
      const scope: ChapterScope = { bookSlug: "pathoma", chapterNumber: 99 };
      expect(getChapterLabel(scope)).toBe("");
    });
  });

  describe("buildChapterPromptPrefix", () => {
    it("builds prefix for Pathoma chapter", () => {
      const scope: ChapterScope = { bookSlug: "pathoma", chapterNumber: 1 };
      const prefix = buildChapterPromptPrefix(scope);
      expect(prefix).toContain("Pathoma");
      expect(prefix).toContain("Chapter 1");
      expect(prefix).toContain(
        "Growth Adaptations, Cellular Injury, and Cell Death"
      );
    });

    it("builds prefix for First Aid chapter", () => {
      const scope: ChapterScope = { bookSlug: "first-aid", chapterNumber: 2 };
      const prefix = buildChapterPromptPrefix(scope);
      expect(prefix).toContain("First Aid");
      expect(prefix).toContain("Chapter 2");
      expect(prefix).toContain("Biochemistry");
    });

    it("returns empty string for unknown book", () => {
      const scope: ChapterScope = { bookSlug: "nope", chapterNumber: 1 };
      expect(buildChapterPromptPrefix(scope)).toBe("");
    });
  });
});
