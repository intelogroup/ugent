import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Convex hooks
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

// Mock Convex API
vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "users:getCurrentUser" },
    threads: { listRecentThreadsWithPreview: "threads:listRecentThreadsWithPreview" },
  },
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ChatHistory } from "@/components/history/chat-history";

describe("ChatHistory", () => {
  const onSelectThread = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state when threads are undefined", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "users:getCurrentUser") return { _id: "user123" };
      return undefined; // threads loading
    });

    render(<ChatHistory onSelectThread={onSelectThread} onBack={onBack} />);
    // Should show a spinner (no text content)
    expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
  });

  it("renders empty state when no threads exist", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "users:getCurrentUser") return { _id: "user123" };
      return []; // empty threads
    });

    render(<ChatHistory onSelectThread={onSelectThread} onBack={onBack} />);
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
  });

  it("renders thread list with preview", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "users:getCurrentUser") return { _id: "user123" };
      return [
        {
          _id: "thread1",
          title: "Cardiac study session",
          platform: "web",
          updatedAt: Date.now() - 60000,
          messageCount: 5,
          lastMessage: {
            content: "What are the signs of heart failure?",
            role: "user",
            createdAt: Date.now() - 60000,
          },
        },
        {
          _id: "thread2",
          title: null,
          platform: "web",
          updatedAt: Date.now() - 3600000,
          messageCount: 3,
          lastMessage: {
            content: "The key features of nephrotic syndrome include...",
            role: "assistant",
            createdAt: Date.now() - 3600000,
          },
        },
      ];
    });

    render(<ChatHistory onSelectThread={onSelectThread} onBack={onBack} />);
    expect(screen.getByText("Cardiac study session")).toBeInTheDocument();
    expect(screen.getByText("Chat History")).toBeInTheDocument();
    expect(screen.getByText("5 messages")).toBeInTheDocument();
  });

  it("calls onSelectThread when a thread is clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "users:getCurrentUser") return { _id: "user123" };
      return [
        {
          _id: "thread1",
          title: "Test thread",
          platform: "web",
          updatedAt: Date.now(),
          messageCount: 2,
          lastMessage: {
            content: "Hello",
            role: "user",
            createdAt: Date.now(),
          },
        },
      ];
    });

    render(<ChatHistory onSelectThread={onSelectThread} onBack={onBack} />);
    await user.click(screen.getByText("Test thread"));
    expect(onSelectThread).toHaveBeenCalledWith("thread1");
  });

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "users:getCurrentUser") return { _id: "user123" };
      return [];
    });

    render(<ChatHistory onSelectThread={onSelectThread} onBack={onBack} />);
    await user.click(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalled();
  });
});
