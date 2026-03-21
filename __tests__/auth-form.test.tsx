import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      emailOtp: vi.fn().mockResolvedValue({ data: { user: { id: "1" } }, error: null }),
    },
    emailOtp: {
      sendVerificationOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

import { authClient } from "@/lib/auth-client";
import { EmailOtpForm } from "@/components/auth/email-otp-form";

describe("EmailOtpForm", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to success by default
    (authClient.emailOtp.sendVerificationOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: {}, error: null });
    (authClient.signIn.emailOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { user: { id: "1" } }, error: null });
  });

  it("renders email input on initial load", () => {
    render(<EmailOtpForm onSuccess={onSuccess} />);
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/code/i)).not.toBeInTheDocument();
  });

  it("shows loading state while sending OTP", async () => {
    let resolve: (v: any) => void;
    (authClient.emailOtp.sendVerificationOtp as ReturnType<typeof vi.fn>)
      .mockReturnValue(new Promise((r) => { resolve = r; }));

    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));

    expect(screen.getByRole("button", { name: /send|continue|next|loading/i })).toBeDisabled();
    resolve!({ data: {}, error: null });
  });

  it("advances to OTP step after successful email submission", async () => {
    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /code|otp/i })).toBeInTheDocument();
    });
  });

  it("stays on email step if sendVerificationOtp fails", async () => {
    (authClient.emailOtp.sendVerificationOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: null, error: { status: 500, message: "Server error" } });

    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("textbox", { name: /code|otp/i })).not.toBeInTheDocument();
  });

  it("calls onSuccess after valid OTP submission", async () => {
    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    // Get to OTP step
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));
    await waitFor(() => screen.getByRole("textbox", { name: /code|otp/i }));

    await user.type(screen.getByRole("textbox", { name: /code|otp/i }), "123456");
    await user.click(screen.getByRole("button", { name: /verify|confirm|sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("shows 'Invalid or expired code' for 400 error", async () => {
    (authClient.signIn.emailOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: null, error: { status: 400, message: "Invalid code" } });

    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));
    await waitFor(() => screen.getByRole("textbox", { name: /code|otp/i }));

    await user.type(screen.getByRole("textbox", { name: /code|otp/i }), "000000");
    await user.click(screen.getByRole("button", { name: /verify|confirm|sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired code/i)).toBeInTheDocument();
    });
  });

  it("shows 'Too many attempts' for 429 error", async () => {
    (authClient.signIn.emailOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: null, error: { status: 429, message: "Rate limited" } });

    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));
    await waitFor(() => screen.getByRole("textbox", { name: /code|otp/i }));

    await user.type(screen.getByRole("textbox", { name: /code|otp/i }), "000000");
    await user.click(screen.getByRole("button", { name: /verify|confirm|sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });

  it("shows generic error for unexpected error status", async () => {
    (authClient.signIn.emailOtp as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: null, error: { status: 503, message: "Service unavailable" } });

    const user = userEvent.setup();
    render(<EmailOtpForm onSuccess={onSuccess} />);

    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send|continue|next/i }));
    await waitFor(() => screen.getByRole("textbox", { name: /code|otp/i }));

    await user.type(screen.getByRole("textbox", { name: /code|otp/i }), "000000");
    await user.click(screen.getByRole("button", { name: /verify|confirm|sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
