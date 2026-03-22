"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js on mount. No-op in browsers without service worker support.
 * Rendered once at the app root so all pages get push support.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("[sw] Registration failed:", err));
    }
  }, []);

  return null;
}
