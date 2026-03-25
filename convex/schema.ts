import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    plan: v.optional(v.string()),
    trialStartedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    telegramId: v.optional(v.string()),
    telegramUsername: v.optional(v.string()),
    whatsappPhone: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
    subscriptionStatus: v.optional(v.string()),
    planExpiresAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_telegram_id", ["telegramId"])
    .index("by_whatsapp_phone", ["whatsappPhone"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  telegramConnectTokens: defineTable({
    userId: v.string(), // WorkOS tokenIdentifier
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  whatsappConnectTokens: defineTable({
    /** Convex user document ID for the whatsapp user */
    userId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  threads: defineTable({
    // WorkOS tokenIdentifier for web users; platform-specific ID for telegram/whatsapp
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
    userId: v.string(), // WorkOS tokenIdentifier
    messageId: v.id("messages"),
    threadId: v.id("threads"),
    /** Snapshot of the Q&A pair so bookmarks remain useful if thread is deleted */
    question: v.string(),
    answer: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_message", ["userId", "messageId"]),

  reviewCards: defineTable({
    userId: v.string(), // WorkOS tokenIdentifier
    bookmarkId: v.id("bookmarks"),
    /** Snapshot of Q&A for display */
    question: v.string(),
    answer: v.string(),
    /** Timestamp (ms) when the card is next due for review */
    dueAt: v.number(),
    /** Current interval step index (0-based into [1,3,7,14,30] days) */
    intervalStep: v.number(),
    /** Total number of times reviewed */
    reviewCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "dueAt"])
    .index("by_user_bookmark", ["userId", "bookmarkId"]),

  confidenceRatings: defineTable({
    userId: v.string(), // WorkOS tokenIdentifier
    bookSlug: v.string(),
    chapterNumber: v.number(),
    /** 1-5 confidence scale */
    rating: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_chapter", ["userId", "bookSlug", "chapterNumber"])
    .index("by_user", ["userId"]),

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

  pushSubscriptions: defineTable({
    /** Convex user document ID */
    userId: v.id("users"),
    /** PushSubscription.endpoint */
    endpoint: v.string(),
    /** PushSubscription.keys.p256dh */
    p256dh: v.string(),
    /** PushSubscription.keys.auth */
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
});
