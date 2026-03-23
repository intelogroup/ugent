"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MessageCircle, Send, X, CheckCircle2, RefreshCw } from "lucide-react";

type Tab = "telegram" | "whatsapp";

interface ConnectResult {
  token: string;
  deepLink?: string;
  waLink?: string;
  expiresAt: number;
}

export function BotConnectModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("telegram");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);

  const currentUser = useQuery(api.users.getCurrentUser);
  const status = useQuery(api.botOnboarding.getConnectionStatus, currentUser?._id ? {} : "skip");
  const genTelegram = useMutation(api.botOnboarding.generateTelegramToken);
  const genWhatsapp = useMutation(api.botOnboarding.generateWhatsappToken);

  const isConnected =
    tab === "telegram" ? status?.telegramConnected : status?.whatsappConnected;

  async function handleGenerate() {
    setLoading(true);
    setResult(null);
    try {
      if (tab === "telegram") {
        const r = await genTelegram({});
        setResult(r);
      } else {
        const r = await genWhatsapp({});
        setResult(r);
      }
    } finally {
      setLoading(false);
    }
  }

  const qrValue = result
    ? tab === "telegram"
      ? result.deepLink ?? ""
      : result.waLink ?? ""
    : "";

  const openLink = result
    ? tab === "telegram"
      ? result.deepLink
      : result.waLink
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-background border rounded-2xl shadow-2xl p-6 w-96 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-accent rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-semibold text-base">Connect Bot Delivery</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Link your Telegram or WhatsApp account to receive daily USMLE facts and
          access your web study session from your phone.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {(["telegram", "whatsapp"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setResult(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                tab === t
                  ? "bg-background border-x border-t text-foreground -mb-px"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "telegram" ? (
                <Send className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
              )}
              {t === "telegram" ? "Telegram" : "WhatsApp"}
            </button>
          ))}
        </div>

        {/* Connected state */}
        {isConnected && !result && (
          <div className="flex flex-col items-center gap-2 py-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {tab === "telegram"
                ? `Connected${status?.telegramUsername ? ` as @${status.telegramUsername}` : ""}`
                : "WhatsApp connected"}
            </p>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-link account
            </button>
          </div>
        )}

        {/* Not yet connected */}
        {!isConnected && !result && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {tab === "telegram"
                ? "Generate a code, then open it in Telegram to link your account."
                : "Generate a code, then send it to the WhatsApp bot to link your account."}
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : tab === "telegram" ? (
                <Send className="h-4 w-4" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              {loading ? "Generating…" : "Generate Connect Code"}
            </button>
          </div>
        )}

        {/* QR + link after generation */}
        {result && qrValue && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={qrValue} size={160} />
            </div>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Scan with{" "}
              {tab === "telegram" ? "your phone camera / Telegram" : "WhatsApp"} to
              open the bot, or tap the button below.
            </p>
            <p className="text-sm font-bold tracking-widest text-foreground">
              Code: {result.token}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Expires in 15 minutes
            </p>
            {openLink && (
              <a
                href={openLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full text-center text-sm font-medium py-2 px-4 rounded-lg transition-colors text-white ${
                  tab === "telegram"
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-green-500 hover:bg-green-600"
                }`}
              >
                Open in {tab === "telegram" ? "Telegram" : "WhatsApp"}
              </a>
            )}
            <button
              onClick={handleGenerate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> New code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
