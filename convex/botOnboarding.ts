/**
 * Bot onboarding — generate short-lived tokens that let Telegram/WhatsApp bots
 * link an incoming message to the authenticated web user.
 *
 * Flow:
 *   1. Web user opens "Connect Bot" modal → calls generateTelegramToken or generateWhatsappToken
 *   2. Backend returns a short numeric token (6 digits) and a deep-link / wa.me URL
 *   3. User scans QR or taps the link → bot receives the message containing the token
 *   4. Bot webhook calls consumeTelegramToken / consumeWhatsappToken with the token + sender ID
 *   5. On success, the user row is updated with telegramId / whatsappPhone
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function randomSixDigit(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getAuthUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity.tokenIdentifier;
}

// ─── Telegram ────────────────────────────────────────────────────────────────

/**
 * Generate a Telegram connect token for the current web user.
 * Returns the token and a t.me deep-link URL.
 */
export const generateTelegramToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Invalidate any prior unexpired tokens for this user
    const prior = await ctx.db
      .query("telegramConnectTokens")
      .withIndex("by_token")
      .filter((q) => q.eq(q.field("used"), false))
      .collect();

    for (const t of prior) {
      if (t.userId === userId && t.expiresAt > Date.now()) {
        await ctx.db.patch(t._id, { used: true });
      }
    }

    const token = randomSixDigit();
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    await ctx.db.insert("telegramConnectTokens", {
      userId,
      token,
      expiresAt,
      used: false,
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "UGentMedBot";
    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    return { token, deepLink, expiresAt };
  },
});

/**
 * Consume a Telegram token (called from the Telegram webhook when a user sends
 * /start <token>). Links the Telegram chat ID to the web user.
 * Returns "ok" | "invalid" | "expired" | "used".
 */
export const consumeTelegramToken = mutation({
  args: {
    token: v.string(),
    telegramId: v.string(),
    telegramUsername: v.optional(v.string()),
    webhookSecret: v.string(),
  },
  handler: async (ctx, { token, telegramId, telegramUsername, webhookSecret }) => {
    // Validate caller is our webhook (shared secret passed in mutation args)
    if (webhookSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      throw new Error("Unauthorized");
    }

    const record = await ctx.db
      .query("telegramConnectTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!record) return { status: "invalid" };
    if (record.used) return { status: "used" };
    if (record.expiresAt < Date.now()) return { status: "expired" };

    // Mark used
    await ctx.db.patch(record._id, { used: true });

    // Find the users row that matches this tokenIdentifier
    const userRow = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", record.userId))
      .first();

    if (userRow) {
      await ctx.db.patch(userRow._id, {
        telegramId,
        telegramUsername: telegramUsername ?? undefined,
      });
    }

    return { status: "ok", userId: record.userId };
  },
});

// ─── WhatsApp ────────────────────────────────────────────────────────────────

/**
 * Generate a WhatsApp connect token for the current web user.
 * Returns the token, a wa.me link, and a QR-code value.
 */
export const generateWhatsappToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Invalidate prior tokens
    const prior = await ctx.db
      .query("whatsappConnectTokens")
      .withIndex("by_token")
      .filter((q) => q.eq(q.field("used"), false))
      .collect();

    for (const t of prior) {
      if (t.userId === userId && t.expiresAt > Date.now()) {
        await ctx.db.patch(t._id, { used: true });
      }
    }

    const token = randomSixDigit();
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    await ctx.db.insert("whatsappConnectTokens", {
      userId,
      token,
      expiresAt,
      used: false,
    });

    const waNumber = process.env.WHATSAPP_NUMBER ?? "15551842363";
    const waLink = `https://wa.me/${waNumber}?text=connect+${token}`;

    return { token, waLink, expiresAt };
  },
});

/**
 * Consume a WhatsApp connect token (called from the WhatsApp webhook when a user
 * sends "connect <token>"). Links the WhatsApp phone number to the web user.
 * Returns "ok" | "invalid" | "expired" | "used".
 */
export const consumeWhatsappToken = mutation({
  args: {
    token: v.string(),
    phone: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, { token, phone, webhookSecret }) => {
    if (webhookSecret !== process.env.WHATSAPP_VERIFY_TOKEN) {
      throw new Error("Unauthorized");
    }

    const record = await ctx.db
      .query("whatsappConnectTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!record) return { status: "invalid" };
    if (record.used) return { status: "used" };
    if (record.expiresAt < Date.now()) return { status: "expired" };

    await ctx.db.patch(record._id, { used: true });

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", record.userId))
      .first();

    if (userRow) {
      await ctx.db.patch(userRow._id, { whatsappPhone: phone });
    }

    return { status: "ok", userId: record.userId };
  },
});

/**
 * Get the current connection status for the authenticated web user.
 */
export const getConnectionStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    return {
      telegramConnected: !!userRow?.telegramId,
      telegramUsername: userRow?.telegramUsername ?? null,
      whatsappConnected: !!userRow?.whatsappPhone,
    };
  },
});

/**
 * Unlink the current user's Telegram account.
 * Clears telegramId and telegramUsername from the user row.
 */
export const disconnectTelegram = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userRow = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (userRow) {
      await ctx.db.patch(userRow._id, {
        telegramId: undefined,
        telegramUsername: undefined,
      });
    }
  },
});
