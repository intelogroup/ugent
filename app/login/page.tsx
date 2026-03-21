"use client";

import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { EmailOtpForm } from "@/components/auth/email-otp-form";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6">
        <Bot className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">UGent MedBot</h1>
      <p className="text-gray-500 text-sm mb-8">Sign in to continue</p>
      <EmailOtpForm onSuccess={() => router.push("/chat")} />
    </div>
  );
}
