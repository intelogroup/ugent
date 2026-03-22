import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock convex/react — browse page now uses useQuery and useConvexAuth
vi.mock("convex/react", () => ({
  useQuery: () => ({}),
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// Mock convex API
vi.mock("@/convex/_generated/api", () => ({
  api: {
    confidenceRatings: {
      setRating: "confidenceRatings:setRating",
      listRatings: "confidenceRatings:listRatings",
    },
  },
}));

import BrowsePage from "@/app/(app)/browse/page";

/** Get the organ-system filter chip (not a chapter button) by name. */
function getChipButton(name: RegExp): HTMLElement {
  const buttons = screen.getAllByRole("button", { name });
  // The chip button text does NOT include "Ch." — chapter buttons do
  const chip = buttons.find(
    (btn) => !btn.textContent?.includes("Ch.")
  );
  if (!chip) throw new Error(`Chip button matching ${name} not found`);
  return chip;
}

describe("BrowsePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    render(<BrowsePage />);
    expect(screen.getByText("Browse Topics")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<BrowsePage />);
    expect(screen.getByPlaceholderText("Search chapters...")).toBeInTheDocument();
  });

  it("renders Pathoma and First Aid book sections", () => {
    render(<BrowsePage />);
    expect(screen.getByText("Pathoma (2021)")).toBeInTheDocument();
    expect(screen.getByText("First Aid (2023)")).toBeInTheDocument();
  });

  it('renders the "All" organ system filter chip', () => {
    render(<BrowsePage />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("renders organ system filter chips", () => {
    render(<BrowsePage />);
    // Use getAllByRole since chapter buttons may also contain the system name
    const cardioButtons = screen.getAllByRole("button", { name: /Cardiovascular/ });
    expect(cardioButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Neurology/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Respiratory/ }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Pathoma chapters", () => {
    render(<BrowsePage />);
    expect(screen.getByText(/Ch\. 1: Growth Adaptations/)).toBeInTheDocument();
    expect(screen.getByText(/Ch\. 8: Cardiac Pathology/)).toBeInTheDocument();
  });

  it("renders First Aid chapters", () => {
    render(<BrowsePage />);
    expect(screen.getByText(/Ch\. 2: Biochemistry/)).toBeInTheDocument();
    expect(screen.getByText(/Ch\. 8: Cardiovascular/)).toBeInTheDocument();
  });

  it("filters chapters by search query", async () => {
    const user = userEvent.setup();
    render(<BrowsePage />);

    await user.type(screen.getByPlaceholderText("Search chapters..."), "cardiac");

    // Pathoma Ch 8 "Cardiac Pathology" should be visible
    expect(screen.getByText(/Ch\. 8: Cardiac Pathology/)).toBeInTheDocument();
    // Unrelated chapters should be gone
    expect(screen.queryByText(/Ch\. 1: Growth Adaptations/)).not.toBeInTheDocument();
  });

  it("shows empty state when no chapters match search", async () => {
    const user = userEvent.setup();
    render(<BrowsePage />);

    await user.type(screen.getByPlaceholderText("Search chapters..."), "xyznonexistent");

    expect(screen.getByText("No chapters match your search")).toBeInTheDocument();
  });

  it("filters by organ system chip", async () => {
    const user = userEvent.setup();
    render(<BrowsePage />);

    await user.click(getChipButton(/Cardiovascular/));

    // Cardiac/vascular chapters should appear
    expect(screen.getByText(/Ch\. 8: Cardiac Pathology/)).toBeInTheDocument();
    // Unrelated chapters should be hidden
    expect(screen.queryByText(/Ch\. 17: Central Nervous System/)).not.toBeInTheDocument();
  });

  it("navigates to chat with chapter prompt on click", async () => {
    const user = userEvent.setup();
    render(<BrowsePage />);

    // Click on a Pathoma chapter — find the text, then the closest button ancestor
    const chapterText = screen.getByText(/Ch\. 8: Cardiac Pathology/);
    const chatButton = chapterText.closest("button");
    expect(chatButton).not.toBeNull();
    await user.click(chatButton!);

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("/chat?prompt=")
    );
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("Cardiac%20Pathology")
    );
  });

  it("toggles organ system chip off when clicked again", async () => {
    const user = userEvent.setup();
    render(<BrowsePage />);

    const cardioChip = getChipButton(/Cardiovascular/);
    // Click to filter
    await user.click(cardioChip);
    expect(screen.queryByText(/Ch\. 17: Central Nervous System/)).not.toBeInTheDocument();

    // Click again to deselect — re-query because React re-renders
    await user.click(getChipButton(/Cardiovascular/));
    // All chapters should be back
    expect(screen.getByText(/Ch\. 17: Central Nervous System/)).toBeInTheDocument();
  });
});
