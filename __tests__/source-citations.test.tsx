import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCitations, SourceInfo } from "@/components/chat/source-citations";

describe("SourceCitations", () => {
  it("renders nothing when sources is empty", () => {
    const { container } = render(<SourceCitations sources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when sources is undefined-like", () => {
    // @ts-expect-error — testing runtime safety for undefined
    const { container } = render(<SourceCitations sources={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single source badge", () => {
    const sources: SourceInfo[] = [
      { book: "First Aid", chapter: "Ch. 3 — Cardiology" },
    ];
    render(<SourceCitations sources={sources} />);

    const badge = screen.getByTestId("source-citation-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("First Aid — Ch. 3 — Cardiology");
  });

  it("renders multiple source badges", () => {
    const sources: SourceInfo[] = [
      { book: "First Aid", chapter: "Ch. 3 — Cardiology" },
      { book: "Pathoma", chapter: "Ch. 8 — Cardiac Pathology" },
    ];
    render(<SourceCitations sources={sources} />);

    const badges = screen.getAllByTestId("source-citation-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("First Aid — Ch. 3 — Cardiology");
    expect(badges[1]).toHaveTextContent("Pathoma — Ch. 8 — Cardiac Pathology");
  });

  it("wraps badges in a container with the correct test id", () => {
    const sources: SourceInfo[] = [
      { book: "First Aid", chapter: "Ch. 8 — Cardiovascular" },
    ];
    render(<SourceCitations sources={sources} />);

    expect(screen.getByTestId("source-citations")).toBeInTheDocument();
  });

  it("handles duplicate sources without crashing", () => {
    const sources: SourceInfo[] = [
      { book: "First Aid", chapter: "Ch. 3 — Cardiology" },
      { book: "First Aid", chapter: "Ch. 3 — Cardiology" },
    ];
    render(<SourceCitations sources={sources} />);

    const badges = screen.getAllByTestId("source-citation-badge");
    expect(badges).toHaveLength(2);
  });
});
