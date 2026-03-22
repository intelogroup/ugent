import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.optional(v.string()),
    telegramId: v.optional(v.string()),
    telegramUsername: v.optional(v.string()),
    whatsappPhone: v.optional(v.string()),
    plan: v.union(v.literal("trial"), v.literal("pro"), v.literal("expired")),
    trialStartedAt: v.number(),
    stripeCustomerId: v.optional(v.string()),
    planExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    authId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_telegram_id", ["telegramId"])
    .index("by_whatsapp_phone", ["whatsappPhone"])
    .index("by_auth_id", ["authId"]),

  telegramConnectTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  threads: defineTable({
    // Better Auth user ID (string UUID) — custom users table is Phase 3
    userId: v.string(),
    platform: v.union(
      v.literal("web"),
      v.literal("telegram"),
      v.literal("whatsapp")
    ),
    title: v.optional(v.string()),
    /** Chapter scope for navigator — e.g. { bookSlug: "pathoma", chapterNumber: 3 } */
    chapterScope: v.optional(
      v.object({
        bookSlug: v.string(),
        chapterNumber: v.number(),
      })
    ),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "updatedAt"])
    .index("by_user_platform", ["userId", "platform"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    imageAnnotations: v.optional(v.array(v.any())),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  bookmarks: defineTable({
    userId: v.string(), // Better Auth user ID
    messageId: v.id("messages"),
    threadId: v.id("threads"),
    /** Snapshot of the Q&A pair so bookmarks remain useful if thread is deleted */
    question: v.string(),
    answer: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_message", ["userId", "messageId"]),

  jobs: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("research"), v.literal("digest")),
    researchTopic: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId", "createdAt"]),
});
