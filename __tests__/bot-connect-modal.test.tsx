import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BotConnectModal } from "@/components/onboarding/bot-connect-modal";

// Mock react-qr-code
vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => <div data-testid="qrcode" data-value={value} />,
}));

// Mock convex/react
const mockGenerateTelegram = vi.fn();
const mockGenerateWhatsapp = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (key: string) => {
    if (key === "botOnboarding:generateTelegramToken") return mockGenerateTelegram;
    if (key === "botOnboarding:generateWhatsappToken") return mockGenerateWhatsapp;
    return vi.fn();
  },
  useQuery: vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    botOnboarding: {
      generateTelegramToken: "botOnboarding:generateTelegramToken",
      generateWhatsappToken: "botOnboarding:generateWhatsappToken",
      getConnectionStatus: "botOnboarding:getConnectionStatus",
    },
  },
}));

import { useQuery } from "convex/react";

describe("BotConnectModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      telegramConnected: false,
      telegramUsername: null,
      whatsappConnected: false,
    });
  });

  it("renders Telegram and WhatsApp tabs", () => {
    render(<BotConnectModal onClose={onClose} />);
    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(<BotConnectModal onClose={onClose} />);
    // Click backdrop (first child of fixed container)
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    render(<BotConnectModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Generate Connect Code button when not connected", () => {
    render(<BotConnectModal onClose={onClose} />);
    expect(screen.getByText("Generate Connect Code")).toBeInTheDocument();
  });

  it("shows connected state when telegramConnected is true", () => {
    vi.mocked(useQuery).mockReturnValue({
      telegramConnected: true,
      telegramUsername: "testuser",
      whatsappConnected: false,
    });
    render(<BotConnectModal onClose={onClose} />);
    expect(screen.getByText(/Connected.*testuser/i)).toBeInTheDocument();
  });

  it("switches to WhatsApp tab", () => {
    render(<BotConnectModal onClose={onClose} />);
    fireEvent.click(screen.getByText("WhatsApp"));
    expect(screen.getByText("Generate Connect Code")).toBeInTheDocument();
  });

  it("shows QR code and token after successful generation", async () => {
    mockGenerateTelegram.mockResolvedValue({
      token: "123456",
      deepLink: "https://t.me/UGentMedBot?start=123456",
      expiresAt: Date.now() + 900000,
    });
    render(<BotConnectModal onClose={onClose} />);
    fireEvent.click(screen.getByText("Generate Connect Code"));
    // Wait for async mutation
    await vi.waitFor(() => {
      expect(screen.getByText("Code: 123456")).toBeInTheDocument();
    });
    expect(screen.getByTestId("qrcode")).toBeInTheDocument();
    expect(screen.getByText("Open in Telegram")).toBeInTheDocument();
  });
});
