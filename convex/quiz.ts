import { action } from "./_generated/server";
import { v } from "convex/values";
import { generateQuizCore } from "./quizCore";

export type { MCQOption, MCQuestion } from "./quizCore";

/**
 * Generate 5 multiple-choice questions for a given chapter/topic.
 * Calls OpenAI directly via fetch using the OPENAI_API_KEY env var.
 */
export const generateQuiz = action({
  args: {
    topic: v.string(),
    bookSlug: v.optional(v.string()),
    chapterNumber: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return generateQuizCore(args, process.env.OPENAI_API_KEY);
  },
});
