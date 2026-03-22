"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface EmailOtpFormProps {
  onSuccess: () => void;
}

export function EmailOtpForm({ onSuccess }: EmailOtpFormProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    setLoading(false);

    if (error) {
      setError("Failed to send code. Please try again.");
      return;
    }

    setStep("otp");
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await authClient.signIn.emailOtp({ email, otp });

    if (error) {
      setLoading(false);
      if (error.status === 400) {
        setError("Invalid or expired code");
      } else if (error.status === 429) {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      return;
    }

    // After OTP sign-in, the convexClient plugin sets the Convex auth token
    // asynchronously from the session response. Calling getSession() here forces
    // the plugin to confirm the session is live before we navigate, preventing
    // the race where the dashboard renders before Convex receives the token.
    if (data) {
      await authClient.getSession();
    }

    setLoading(false);
    onSuccess();
  };

  if (step === "email") {
    return (
      <form
        onSubmit={handleEmailSubmit}
        className="flex flex-col gap-4 w-full max-w-sm"
      >
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Continue"}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleOtpSubmit}
      className="flex flex-col gap-4 w-full max-w-sm"
    >
      <p className="text-sm text-gray-500">Enter the code sent to {email}</p>
      <input
        aria-label="Code"
        type="text"
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        required
        maxLength={6}
        className="border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center"
      />
      {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => setStep("email")}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        Use a different email
      </button>
    </form>
  );
}
