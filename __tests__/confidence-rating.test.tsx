import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfidenceBadge } from "@/components/chapters/confidence-rating";

// Mock convex/react
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => ({}),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// Mock the convex API module
vi.mock("@/convex/_generated/api", () => ({
  api: {
    confidenceRatings: {
      setRating: "confidenceRatings:setRating",
      listRatings: "confidenceRatings:listRatings",
    },
  },
}));

describe("ConfidenceBadge", () => {
  it("renders nothing when no rating", () => {
    const { container } = render(<ConfidenceBadge />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for undefined rating", () => {
    const { container } = render(<ConfidenceBadge rating={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders badge with correct label for rating 1", () => {
    render(<ConfidenceBadge rating={1} />);
    expect(screen.getByText("No idea")).toBeInTheDocument();
  });

  it("renders badge with correct label for rating 3", () => {
    render(<ConfidenceBadge rating={3} />);
    expect(screen.getByText("Okay")).toBeInTheDocument();
  });

  it("renders badge with correct label for rating 5", () => {
    render(<ConfidenceBadge rating={5} />);
    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("renders nothing for invalid rating", () => {
    const { container } = render(<ConfidenceBadge rating={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for rating 6 (out of range)", () => {
    const { container } = render(<ConfidenceBadge rating={6} />);
    expect(container.innerHTML).toBe("");
  });
});
