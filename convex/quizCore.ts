export interface MCQOption {
  label: string; // "A" | "B" | "C" | "D"
  text: string;
}

export interface MCQuestion {
  question: string;
  options: MCQOption[];
  correctLabel: string; // "A" | "B" | "C" | "D"
  explanation: string;
}

export interface GenerateQuizArgs {
  topic: string;
  bookSlug?: string;
  chapterNumber?: number;
}

/**
 * Core quiz generation logic. Builds the prompt, calls OpenAI, and parses
 * the response into an array of MCQ objects.
 *
 * Accepts an optional `fetchFn` for testability (defaults to global `fetch`).
 */
export async function generateQuizCore(
  args: GenerateQuizArgs,
  apiKey: string | undefined,
  fetchFn: typeof fetch = fetch,
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

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content ?? "";

  let questions: MCQuestion[];
  try {
    questions = JSON.parse(content) as MCQuestion[];
  } catch {
    // Attempt to extract JSON array if model wrapped it
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error("Failed to parse quiz questions from OpenAI response");
    }
    questions = JSON.parse(match[0]) as MCQuestion[];
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("OpenAI returned an empty or invalid quiz");
  }

  // Clamp to 5 questions
  return questions.slice(0, 5);
}
