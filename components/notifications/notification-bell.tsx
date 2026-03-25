"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { Bell, BellOff } from "lucide-react";
import type { Fact } from "@/lib/facts-agent";

const STORAGE_KEY = "facts_last_seen";
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const PUSH_STORAGE_KEY = "push_subscribed";

export function NotificationBell() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [facts, setFacts] = useState<Fact[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchFacts() {
    try {
      setLoading(true);
      const res = await fetch("/api/facts");
      if (!res.ok) return;
      const data = (await res.json()) as { facts: Fact[] };
      const incoming = data.facts ?? [];
      setFacts(incoming);

      // Count facts newer than last-seen timestamp
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      const newCount = incoming.filter(
        (f) => new Date(f.generatedAt).getTime() > lastSeenMs
      ).length;
      setUnread(newCount);
    } catch {
      // silently fail — non-critical feature
    } finally {
      setLoading(false);
    }
  }

  // Detect push support and restore subscribed state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (supported) {
      setPushSubscribed(localStorage.getItem(PUSH_STORAGE_KEY) === "true");
    }
  }, []);

  async function handlePushToggle() {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribePush();
      } else {
        await subscribePush();
      }
    } finally {
      setPushLoading(false);
    }
  }

  async function subscribePush() {
    try {
      const reg = await navigator.serviceWorker.ready;

      // Fetch VAPID public key from server
      const keyRes = await fetch("/api/notifications/subscribe");
      if (!keyRes.ok) return;
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const sub = subscription.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      localStorage.setItem(PUSH_STORAGE_KEY, "true");
      setPushSubscribed(true);
    } catch (err) {
      console.error("[push] Subscribe failed:", err);
    }
  }

  async function unsubscribePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      localStorage.removeItem(PUSH_STORAGE_KEY);
      setPushSubscribed(false);
    } catch (err) {
      console.error("[push] Unsubscribe failed:", err);
    }
  }

  // Only poll /api/facts when authenticated to avoid 401 console spam
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchFacts();
    const id = setInterval(fetchFacts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && facts.length > 0) {
      // Mark all as read
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setUnread(0);
    }
  }

  const CATEGORY_COLORS: Record<string, string> = {
    Cardiology: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    Pulmonology: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    Nephrology: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    GI: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    Endocrinology: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    Hematology: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    "Infectious Disease": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Neurology: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    Oncology: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    Immunology: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    Pharmacology: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
    Pathology: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 hover:bg-accent rounded-lg transition-colors"
        aria-label="High-yield facts notifications"
      >
        <Bell className={`h-5 w-5 ${loading ? "animate-pulse opacity-60" : ""}`} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(384px,calc(100vw-2rem))] max-h-[520px] overflow-y-auto rounded-xl border bg-background shadow-xl z-50">
          <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">High-Yield Facts</p>
              <p className="text-xs text-muted-foreground">Refreshed every 2 hours</p>
            </div>
            <div className="flex items-center gap-2">
              {pushSupported && isAuthenticated && (
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  aria-label={pushSubscribed ? "Disable push notifications" : "Enable push notifications"}
                  title={pushSubscribed ? "Turn off daily fact push" : "Get daily facts pushed to you"}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {pushSubscribed ? (
                    <BellOff className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
              <button
                onClick={fetchFacts}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          {facts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {loading ? "Researching facts…" : "No facts yet"}
            </div>
          ) : (
            <ul className="divide-y">
              {facts.map((fact) => (
                <li key={fact.id} className="px-4 py-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        CATEGORY_COLORS[fact.category] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {fact.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {fact.source}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground leading-relaxed">
                    {fact.fact}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {facts.length > 0 && (
            <div className="sticky bottom-0 bg-background border-t px-4 py-2 text-[10px] text-muted-foreground text-center">
              Generated {facts[0] ? new Date(facts[0].generatedAt).toLocaleTimeString() : "—"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Convert a base64url VAPID public key to a Uint8Array for PushManager.subscribe */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
