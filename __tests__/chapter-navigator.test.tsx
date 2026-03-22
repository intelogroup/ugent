import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ChapterNavigator } from "@/components/chapters/chapter-navigator";

describe("ChapterNavigator", () => {
  const onClose = vi.fn();
  const onSelectChapter = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Chapters heading when open", () => {
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );
    expect(screen.getByText("Chapters")).toBeInTheDocument();
  });

  it("renders both book sections", () => {
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );
    expect(screen.getByText("Pathoma (2021)")).toBeInTheDocument();
    expect(screen.getByText("First Aid (2023)")).toBeInTheDocument();
  });

  it("renders Pathoma chapters", () => {
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );
    expect(
      screen.getByText("Growth Adaptations, Cellular Injury, and Cell Death")
    ).toBeInTheDocument();
    expect(screen.getByText("Cardiac Pathology")).toBeInTheDocument();
  });

  it("renders First Aid chapters", () => {
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );
    expect(screen.getByText("Biochemistry")).toBeInTheDocument();
    expect(screen.getByText("Cardiovascular")).toBeInTheDocument();
  });

  it("calls onSelectChapter with correct scope when chapter clicked", async () => {
    const user = userEvent.setup();
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );

    await user.click(screen.getByText("Cardiac Pathology"));

    expect(onSelectChapter).toHaveBeenCalledWith({
      bookSlug: "pathoma",
      chapterNumber: 8,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("filters chapters by search query", async () => {
    const user = userEvent.setup();
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );

    await user.type(
      screen.getByPlaceholderText("Search chapters..."),
      "cardiac"
    );

    expect(screen.getByText("Cardiac Pathology")).toBeInTheDocument();
    expect(
      screen.queryByText("Skin Pathology")
    ).not.toBeInTheDocument();
  });

  it("shows empty state when no chapters match search", async () => {
    const user = userEvent.setup();
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );

    await user.type(
      screen.getByPlaceholderText("Search chapters..."),
      "xyznonexistent"
    );

    expect(screen.getByText("No chapters match")).toBeInTheDocument();
  });

  it("collapses a book section when header is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ChapterNavigator
        isOpen={true}
        onClose={onClose}
        onSelectChapter={onSelectChapter}
      />
    );

    // Pathoma chapters are visible initially
    expect(screen.getByText("Cardiac Pathology")).toBeInTheDocument();

    // Click the Pathoma book header to collapse
    await user.click(screen.getByText("Pathoma (2021)"));

    // Pathoma chapters should be hidden
    expect(screen.queryByText("Cardiac Pathology")).not.toBeInTheDocument();
  });
});
