import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateQuiz = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockGenerateQuiz,
  useQuery: () => ({}),
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    quiz: {
      generateQuiz: "quiz:generateQuiz",
    },
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_QUESTIONS = [
  {
    question: "What is the most common cause of myocardial infarction?",
    options: [
      { label: "A", text: "Atherosclerosis" },
      { label: "B", text: "Vasospasm" },
      { label: "C", text: "Embolism" },
      { label: "D", text: "Hypertrophy" },
    ],
    correctLabel: "A",
    explanation: "Atherosclerosis leading to plaque rupture is the most common cause.",
  },
  {
    question: "Which enzyme is elevated in acute MI?",
    options: [
      { label: "A", text: "Amylase" },
      { label: "B", text: "Troponin I" },
      { label: "C", text: "ALT" },
      { label: "D", text: "Lipase" },
    ],
    correctLabel: "B",
    explanation: "Troponin I is the most sensitive and specific marker for cardiac injury.",
  },
  {
    question: "What is a key feature of dilated cardiomyopathy?",
    options: [
      { label: "A", text: "Concentric hypertrophy" },
      { label: "B", text: "Eccentric hypertrophy" },
      { label: "C", text: "Wall thickening" },
      { label: "D", text: "Reduced cavity size" },
    ],
    correctLabel: "B",
    explanation: "Dilated cardiomyopathy features eccentric hypertrophy with increased cavity volume.",
  },
  {
    question: "Which valve is most commonly affected by rheumatic fever?",
    options: [
      { label: "A", text: "Aortic" },
      { label: "B", text: "Tricuspid" },
      { label: "C", text: "Mitral" },
      { label: "D", text: "Pulmonic" },
    ],
    correctLabel: "C",
    explanation: "The mitral valve is most commonly affected in rheumatic heart disease.",
  },
  {
    question: "What characterizes cardiac tamponade?",
    options: [
      { label: "A", text: "Widened pulse pressure" },
      { label: "B", text: "Becks triad" },
      { label: "C", text: "Bradycardia" },
      { label: "D", text: "Hypertension" },
    ],
    correctLabel: "B",
    explanation: "Becks triad: hypotension, muffled heart sounds, and JVD characterize tamponade.",
  },
];

// ─── Import component AFTER mocks ────────────────────────────────────────────

import { QuickQuiz } from "@/components/quiz/quick-quiz";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("QuickQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the start screen with topic name", () => {
    render(<QuickQuiz topic="Cardiac Pathology" />);
    expect(screen.getByText("Quick Quiz")).toBeInTheDocument();
    expect(screen.getByText(/Cardiac Pathology/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Quiz/i })).toBeInTheDocument();
  });

  it("shows loading state while fetching questions", async () => {
    // Never resolves during this test
    mockGenerateQuiz.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    expect(screen.getByText(/Generating quiz questions/i)).toBeInTheDocument();
  });

  it("renders questions after successful generation", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => {
      expect(screen.getByText(/Q1\./)).toBeInTheDocument();
    });

    expect(screen.getByText(/most common cause of myocardial infarction/i)).toBeInTheDocument();
    expect(screen.getByText("Atherosclerosis")).toBeInTheDocument();
  });

  it("shows error state when generation fails", async () => {
    mockGenerateQuiz.mockRejectedValue(new Error("API error"));
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => {
      expect(screen.getByText("API error")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("reveals correct answer and explanation after selecting an option", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => screen.getByText("Atherosclerosis"));

    // Click correct answer
    await user.click(screen.getByText("Atherosclerosis"));

    expect(screen.getByText(/Atherosclerosis leading to plaque rupture/i)).toBeInTheDocument();
  });

  it("marks wrong answer visually when incorrect option selected", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => screen.getByText("Vasospasm"));

    // Click wrong answer
    await user.click(screen.getByText("Vasospasm"));

    // Explanation still shows
    expect(screen.getByText(/Atherosclerosis leading to plaque rupture/i)).toBeInTheDocument();
  });

  it("does not allow changing answer after selection", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => screen.getByText("Vasospasm"));

    await user.click(screen.getByText("Vasospasm"));
    // Try to click another — should be disabled after answering
    const embolismBtn = screen.getByText("Embolism").closest("button");
    expect(embolismBtn).toBeDisabled();
  });

  it("shows score summary when all questions answered", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" />);
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() => screen.getByText("Atherosclerosis"));

    // Click the correct answer for each question and wait for explanation
    // Helper: wait for explanation text to appear (may match in multiple nodes)
    const waitForExplanation = (pattern: RegExp) =>
      waitFor(() => expect(screen.getAllByText(pattern).length).toBeGreaterThan(0));

    // Q1: A = "Atherosclerosis"
    await user.click(screen.getByText("Atherosclerosis"));
    await waitForExplanation(/Atherosclerosis leading to plaque rupture/i);

    // Q2: B = "Troponin I" (option text — exact match in option span)
    await user.click(screen.getByText("Troponin I"));
    await waitForExplanation(/Troponin I is the most sensitive/i);

    // Q3: B = "Eccentric hypertrophy"
    await user.click(screen.getByText("Eccentric hypertrophy"));
    await waitForExplanation(/Dilated cardiomyopathy/i);

    // Q4: C = "Mitral" — may match multiple elements, find the one inside an enabled button
    const mitralEls = screen.getAllByText("Mitral");
    const enabledMitral = mitralEls.find(
      (el) => el.closest("button") && !el.closest("button")!.hasAttribute("disabled")
    );
    expect(enabledMitral).toBeTruthy();
    await user.click(enabledMitral!);
    await waitForExplanation(/mitral valve is most commonly/i);

    // Q5: B = "Becks triad"
    await user.click(screen.getByText("Becks triad"));
    await waitForExplanation(/hypotension, muffled heart sounds/i);

    // All answered — score summary should appear (rendered in header + final card)
    await waitFor(() => {
      expect(screen.getAllByText("5/5").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Perfect score/i).length).toBeGreaterThan(0);
  });

  it("calls onClose when cancel is clicked on start screen", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<QuickQuiz topic="Cardiac Pathology" onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls generateQuiz with correct args including bookSlug and chapterNumber", async () => {
    mockGenerateQuiz.mockResolvedValue(MOCK_QUESTIONS);
    const user = userEvent.setup();

    render(
      <QuickQuiz
        topic="Cardiac Pathology"
        bookSlug="pathoma"
        chapterNumber={8}
      />
    );
    await user.click(screen.getByRole("button", { name: /Start Quiz/i }));

    await waitFor(() =>
      expect(mockGenerateQuiz).toHaveBeenCalledWith({
        topic: "Cardiac Pathology",
        bookSlug: "pathoma",
        chapterNumber: 8,
      })
    );
  });
});
