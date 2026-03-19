"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { MessageCircle, X } from "lucide-react";

const WHATSAPP_NUMBER = "15551842363"; // without +
const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Subscribe`;

export function WhatsAppSubscribe() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-accent rounded-lg transition-colors"
        aria-label="Subscribe on WhatsApp"
        title="Get daily facts on WhatsApp"
      >
        <MessageCircle className="h-5 w-5 text-green-500" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative bg-background border rounded-2xl shadow-2xl p-6 w-80 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1 hover:bg-accent rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-sm">Daily USMLE Facts on WhatsApp</span>
            </div>

            <div className="bg-white p-3 rounded-xl">
              <QRCode value={WA_LINK} size={180} />
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Scan with WhatsApp to subscribe.<br />
              You'll receive high-yield USMLE facts every day.
            </p>

            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center text-xs bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Open in WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
