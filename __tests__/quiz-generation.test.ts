import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateQuizCore, type MCQuestion } from "../convex/quizCore";

/**
 * Tests for the quiz generation endpoint (convex/quiz-core.ts).
 *
 * The production action delegates to generateQuizCore which calls
 * OpenAI's API. We inject a mock fetch to validate prompt construction,
 * error handling, and response parsing without hitting the real API.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_QUESTIONS: MCQuestion[] = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i + 1}?`,
  options: [
    { label: "A", text: `A option ${i}` },
    { label: "B", text: `B option ${i}` },
    { label: "C", text: `C option ${i}` },
    { label: "D", text: `D option ${i}` },
  ],
  correctLabel: "A",
  explanation: `Explanation for Q${i + 1}.`,
}));

function openAIResponse(content: string, status = 200) {
  return {
    ok: status === 200,
    status,
    text: async () => content,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Quiz Generation Endpoint (convex/quiz-core.ts)", () => {
  const mockFetch = vi.fn() as unknown as typeof fetch;
  const API_KEY = "sk-test-key";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Input validation ---

  it("throws when OPENAI_API_KEY is not configured", async () => {
    await expect(
      generateQuizCore({ topic: "Cardiac" }, undefined, mockFetch)
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Prompt construction ---

  it("sends correct prompt for a plain topic", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    await generateQuizCore({ topic: "Cardiac Pathology" }, API_KEY, mockFetch);

    const call = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.openai.com/v1/chat/completions");

    const body = JSON.parse(call[1].body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[1].content).toBe("Generate 5 MCQs about: Cardiac Pathology");
    expect(body.messages[1].content).not.toContain("from ");
  });

  it("includes Pathoma chapter context in prompt", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    await generateQuizCore(
      { topic: "Cell Injury", bookSlug: "pathoma", chapterNumber: 1 },
      API_KEY,
      mockFetch
    );

    const body = JSON.parse(
      (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.messages[1].content).toBe(
      "Generate 5 MCQs about: Cell Injury from Pathoma (2021), Chapter 1"
    );
  });

  it("includes First Aid chapter context in prompt", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    await generateQuizCore(
      { topic: "Immunology", bookSlug: "first-aid", chapterNumber: 3 },
      API_KEY,
      mockFetch
    );

    const body = JSON.parse(
      (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.messages[1].content).toBe(
      "Generate 5 MCQs about: Immunology from First Aid (2023), Chapter 3"
    );
  });

  it("sends Authorization header with API key", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    await generateQuizCore({ topic: "Neoplasia" }, API_KEY, mockFetch);

    const headers = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-test-key");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  // --- Response parsing ---

  it("parses a valid JSON array response", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    const result = await generateQuizCore({ topic: "Hematology" }, API_KEY, mockFetch);

    expect(result).toHaveLength(5);
    expect(result[0].question).toBe("Question 1?");
    expect(result[0].options).toHaveLength(4);
    expect(result[0].correctLabel).toBe("A");
    expect(result[0].explanation).toContain("Q1");
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const wrappedContent = `Here are your questions:\n\`\`\`json\n${JSON.stringify(VALID_QUESTIONS)}\n\`\`\``;
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(wrappedContent)
    );

    const result = await generateQuizCore({ topic: "Renal" }, API_KEY, mockFetch);

    expect(result).toHaveLength(5);
    expect(result[0].question).toBe("Question 1?");
  });

  it("clamps response to 5 questions if model returns more", async () => {
    const sevenQuestions = [...VALID_QUESTIONS, ...VALID_QUESTIONS.slice(0, 2)];
    expect(sevenQuestions).toHaveLength(7);

    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(sevenQuestions))
    );

    const result = await generateQuizCore({ topic: "Endocrine" }, API_KEY, mockFetch);

    expect(result).toHaveLength(5);
  });

  // --- Error handling ---

  it("throws on OpenAI API error (non-200 status)", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse("Rate limit exceeded", 429)
    );

    await expect(
      generateQuizCore({ topic: "GI" }, API_KEY, mockFetch)
    ).rejects.toThrow("OpenAI API error 429: Rate limit exceeded");
  });

  it("throws on OpenAI 500 error", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse("Internal Server Error", 500)
    );

    await expect(
      generateQuizCore({ topic: "Pulmonary" }, API_KEY, mockFetch)
    ).rejects.toThrow("OpenAI API error 500");
  });

  it("throws when response is not valid JSON and has no array", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse("Sorry, I cannot generate questions.")
    );

    await expect(
      generateQuizCore({ topic: "Derm" }, API_KEY, mockFetch)
    ).rejects.toThrow("Failed to parse quiz questions from OpenAI response");
  });

  it("throws when response is an empty array", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse("[]")
    );

    await expect(
      generateQuizCore({ topic: "Neuro" }, API_KEY, mockFetch)
    ).rejects.toThrow("OpenAI returned an empty or invalid quiz");
  });

  // --- Question structure validation ---

  it("returns questions with correct structure", async () => {
    (mockFetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      openAIResponse(JSON.stringify(VALID_QUESTIONS))
    );

    const result = await generateQuizCore({ topic: "MSK" }, API_KEY, mockFetch);

    for (const q of result) {
      expect(q).toHaveProperty("question");
      expect(q).toHaveProperty("options");
      expect(q).toHaveProperty("correctLabel");
      expect(q).toHaveProperty("explanation");
      expect(q.options).toHaveLength(4);
      expect(["A", "B", "C", "D"]).toContain(q.correctLabel);
      for (const opt of q.options) {
        expect(opt).toHaveProperty("label");
        expect(opt).toHaveProperty("text");
      }
    }
  });
});
