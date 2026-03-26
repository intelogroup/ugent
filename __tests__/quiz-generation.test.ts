import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the quiz generation endpoint (convex/quiz.ts).
 *
 * The action calls OpenAI's API to generate MCQs.  We mock `fetch` to
 * validate prompt construction, error handling, and response parsing
 * without hitting the real API.
 */

// ─── Types (mirroring convex/quiz.ts) ────────────────────────────────────────

interface MCQOption {
  label: string;
  text: string;
}

interface MCQuestion {
  question: string;
  options: MCQOption[];
  correctLabel: string;
  explanation: string;
}

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

// ─── Inline handler (mirrors convex/quiz.ts logic) ───────────────────────────
// We extract the core logic so we can test it without the Convex runtime.

async function generateQuizHandler(
  args: { topic: string; bookSlug?: string; chapterNumber?: number },
  fetchFn: typeof fetch,
  apiKey: string | undefined
): Promise<MCQuestion[]> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { topic, bookSlug, chapterNumber } = args;
  const chapterContext =
    bookSlug && chapterNumber
      ? ` from ${bookSlug === "pathoma" ? "Pathoma (2021)" : "First Aid (2023)"}, Chapter ${chapterNumber}`
      : "";

  const systemPrompt = `You are a medical education expert helping USMLE Step 1 students.
Generate exactly 5 multiple-choice questions about the topic provided.
Each question must have 4 options (A, B, C, D) with exactly one correct answer.
Format your response as a valid JSON array with this structure:
[
  {
    "question": "Question text here?",
    "options": [
      {"label": "A", "text": "Option A text"},
      {"label": "B", "text": "Option B text"},
      {"label": "C", "text": "Option C text"},
      {"label": "D", "text": "Option D text"}
    ],
    "correctLabel": "A",
    "explanation": "Brief explanation of why A is correct."
  }
]
Return ONLY the JSON array, no markdown, no extra text.`;

  const userPrompt = `Generate 5 MCQs about: ${topic}${chapterContext}`;

  const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content ?? "";

  let questions: MCQuestion[];
  try {
    questions = JSON.parse(content) as MCQuestion[];
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("Failed to parse quiz questions from OpenAI response");
    }
    questions = JSON.parse(match[0]) as MCQuestion[];
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("OpenAI returned an empty or invalid quiz");
  }

  return questions.slice(0, 5);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Quiz Generation Endpoint (convex/quiz.ts)", () => {
  const mockFetch = vi.fn();
  const API_KEY = "sk-test-key";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Input validation ---

  it("throws when OPENAI_API_KEY is not configured", async () => {
    await expect(
      generateQuizHandler({ topic: "Cardiac" }, mockFetch, undefined)
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Prompt construction ---

  it("sends correct prompt for a plain topic", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    await generateQuizHandler({ topic: "Cardiac Pathology" }, mockFetch, API_KEY);

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe("https://api.openai.com/v1/chat/completions");

    const body = JSON.parse(call[1].body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages[1].content).toBe("Generate 5 MCQs about: Cardiac Pathology");
    expect(body.messages[1].content).not.toContain("from ");
  });

  it("includes Pathoma chapter context in prompt", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    await generateQuizHandler(
      { topic: "Cell Injury", bookSlug: "pathoma", chapterNumber: 1 },
      mockFetch,
      API_KEY
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toBe(
      "Generate 5 MCQs about: Cell Injury from Pathoma (2021), Chapter 1"
    );
  });

  it("includes First Aid chapter context in prompt", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    await generateQuizHandler(
      { topic: "Immunology", bookSlug: "first-aid", chapterNumber: 3 },
      mockFetch,
      API_KEY
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toBe(
      "Generate 5 MCQs about: Immunology from First Aid (2023), Chapter 3"
    );
  });

  it("sends Authorization header with API key", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    await generateQuizHandler({ topic: "Neoplasia" }, mockFetch, API_KEY);

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-test-key");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  // --- Response parsing ---

  it("parses a valid JSON array response", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    const result = await generateQuizHandler({ topic: "Hematology" }, mockFetch, API_KEY);

    expect(result).toHaveLength(5);
    expect(result[0].question).toBe("Question 1?");
    expect(result[0].options).toHaveLength(4);
    expect(result[0].correctLabel).toBe("A");
    expect(result[0].explanation).toContain("Q1");
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const wrappedContent = `Here are your questions:\n\`\`\`json\n${JSON.stringify(VALID_QUESTIONS)}\n\`\`\``;
    mockFetch.mockResolvedValue(openAIResponse(wrappedContent));

    const result = await generateQuizHandler({ topic: "Renal" }, mockFetch, API_KEY);

    expect(result).toHaveLength(5);
    expect(result[0].question).toBe("Question 1?");
  });

  it("clamps response to 5 questions if model returns more", async () => {
    const sevenQuestions = [...VALID_QUESTIONS, ...VALID_QUESTIONS.slice(0, 2)];
    expect(sevenQuestions).toHaveLength(7);

    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(sevenQuestions)));

    const result = await generateQuizHandler({ topic: "Endocrine" }, mockFetch, API_KEY);

    expect(result).toHaveLength(5);
  });

  // --- Error handling ---

  it("throws on OpenAI API error (non-200 status)", async () => {
    mockFetch.mockResolvedValue(openAIResponse("Rate limit exceeded", 429));

    await expect(
      generateQuizHandler({ topic: "GI" }, mockFetch, API_KEY)
    ).rejects.toThrow("OpenAI API error 429: Rate limit exceeded");
  });

  it("throws on OpenAI 500 error", async () => {
    mockFetch.mockResolvedValue(openAIResponse("Internal Server Error", 500));

    await expect(
      generateQuizHandler({ topic: "Pulmonary" }, mockFetch, API_KEY)
    ).rejects.toThrow("OpenAI API error 500");
  });

  it("throws when response is not valid JSON and has no array", async () => {
    mockFetch.mockResolvedValue(openAIResponse("Sorry, I cannot generate questions."));

    await expect(
      generateQuizHandler({ topic: "Derm" }, mockFetch, API_KEY)
    ).rejects.toThrow("Failed to parse quiz questions from OpenAI response");
  });

  it("throws when response is an empty array", async () => {
    mockFetch.mockResolvedValue(openAIResponse("[]"));

    await expect(
      generateQuizHandler({ topic: "Neuro" }, mockFetch, API_KEY)
    ).rejects.toThrow("OpenAI returned an empty or invalid quiz");
  });

  // --- Question structure validation ---

  it("returns questions with correct structure", async () => {
    mockFetch.mockResolvedValue(openAIResponse(JSON.stringify(VALID_QUESTIONS)));

    const result = await generateQuizHandler({ topic: "MSK" }, mockFetch, API_KEY);

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
