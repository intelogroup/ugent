import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressHeatmap } from "@/components/progress/progress-heatmap";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    progressHeatmap: {
      getHeatmapData: "progressHeatmap:getHeatmapData",
    },
    users: {
      getCurrentUser: "users:getCurrentUser",
    },
  },
}));

import { useQuery } from "convex/react";

const MOCK_USER = { _id: "user123" };

/** Helper: mock useQuery so getCurrentUser returns a user and getHeatmapData returns heatmapData */
function mockHeatmapQuery(heatmapData: unknown) {
  vi.mocked(useQuery).mockImplementation((query: unknown) => {
    if (query === "users:getCurrentUser") return MOCK_USER;
    return heatmapData;
  });
}

describe("ProgressHeatmap", () => {
  it("shows loading skeletons while data is undefined", () => {
    mockHeatmapQuery(undefined);
    const { container } = render(<ProgressHeatmap />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when data is empty array", () => {
    mockHeatmapQuery([]);
    render(<ProgressHeatmap />);
    expect(screen.getByText(/No study activity yet/i)).toBeInTheDocument();
  });

  it("renders chapter cells when data has entries", () => {
    mockHeatmapQuery([
      {
        bookSlug: "pathoma",
        bookName: "Pathoma (2021)",
        chapterNumber: 1,
        chapterTitle: "Growth Adaptations, Cellular Injury, and Cell Death",
        threadCount: 2,
        messageCount: 10,
        confidenceRating: 4,
      },
      {
        bookSlug: "pathoma",
        bookName: "Pathoma (2021)",
        chapterNumber: 2,
        chapterTitle: "Inflammation, Inflammatory Disorders, and Wound Healing",
        threadCount: 0,
        messageCount: 0,
        confidenceRating: null,
      },
    ]);
    render(<ProgressHeatmap />);
    expect(screen.getByText(/Ch. 1/)).toBeInTheDocument();
    expect(screen.getByText(/10 msgs/)).toBeInTheDocument();
  });

  it("renders confidence rating label when present", () => {
    mockHeatmapQuery([
      {
        bookSlug: "pathoma",
        bookName: "Pathoma (2021)",
        chapterNumber: 1,
        chapterTitle: "Growth Adaptations",
        threadCount: 1,
        messageCount: 5,
        confidenceRating: 5,
      },
    ]);
    render(<ProgressHeatmap />);
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("does not render confidence label when rating is null", () => {
    mockHeatmapQuery([
      {
        bookSlug: "pathoma",
        bookName: "Pathoma (2021)",
        chapterNumber: 1,
        chapterTitle: "Growth Adaptations",
        threadCount: 0,
        messageCount: 0,
        confidenceRating: null,
      },
    ]);
    render(<ProgressHeatmap />);
    expect(screen.queryByText("Mastered")).not.toBeInTheDocument();
    expect(screen.queryByText("Good")).not.toBeInTheDocument();
  });

  it("renders the heat legend", () => {
    mockHeatmapQuery([
      {
        bookSlug: "pathoma",
        bookName: "Pathoma (2021)",
        chapterNumber: 1,
        chapterTitle: "Test",
        threadCount: 1,
        messageCount: 3,
        confidenceRating: null,
      },
    ]);
    render(<ProgressHeatmap />);
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });
});
