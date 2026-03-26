import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));


vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, loading: false }),
}));

vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => <div data-testid="qrcode" data-value={value} />,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "users:getCurrentUser" },
    threads: { listRecentThreadsWithPreview: "threads:listRecentThreadsWithPreview" },
    bookmarks: { listBookmarks: "bookmarks:listBookmarks" },
    botOnboarding: {
      getConnectionStatus: "botOnboarding:getConnectionStatus",
      generateTelegramToken: "botOnboarding:generateTelegramToken",
      generateWhatsappToken: "botOnboarding:generateWhatsappToken",
      disconnectTelegram: "botOnboarding:disconnectTelegram",
    },
  },
}));

import { useQuery } from "convex/react";
import DashboardPage from "@/app/(app)/dashboard/page";

const mockCurrentUser = { _id: "user-123", email: "test@example.com" };

describe("Dashboard Bot Connect card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockImplementation((key: string) => {
      if (key === "users:getCurrentUser") return mockCurrentUser;
      if (key === "botOnboarding:getConnectionStatus")
        return { telegramConnected: false, telegramUsername: null, whatsappConnected: false };
      if (key === "threads:listRecentThreadsWithPreview") return [];
      if (key === "bookmarks:listBookmarks") return [];
      return undefined;
    });
  });

  it("renders Connect Telegram card", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Connect Telegram/i)).toBeInTheDocument();
  });

  it("opens BotConnectModal when Connect Telegram is clicked", () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText(/Connect Telegram/i));
    expect(screen.getByText("Connect Bot Delivery")).toBeInTheDocument();
  });

  it("shows connected username when linked", () => {
    vi.mocked(useQuery).mockImplementation((key: string) => {
      if (key === "users:getCurrentUser") return mockCurrentUser;
      if (key === "botOnboarding:getConnectionStatus")
        return { telegramConnected: true, telegramUsername: "myuser", whatsappConnected: false };
      if (key === "threads:listRecentThreadsWithPreview") return [];
      if (key === "bookmarks:listBookmarks") return [];
      return undefined;
    });
    render(<DashboardPage />);
    expect(screen.getByText(/@myuser/i)).toBeInTheDocument();
  });
});
