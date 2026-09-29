import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThreadView } from "@/components/results/ThreadView";
import type { Thread } from "@/threads";

describe("ThreadView", () => {
  it("marks the ask whose follow-up the reply answers, when a step has more than one ask", () => {
    const thread: Thread = {
      max: 2,
      end: "decided",
      steps: [
        {
          index: 1,
          decisions: [
            { decision: "ask", followUp: "Welche Quellen?", reason: "No source is named.", errorClass: null, stale: false },
            { decision: "ask", followUp: "Wie viele Lieferanten?", reason: "Retried after a rejection.", errorClass: null, stale: false },
          ],
          reply: { question: "Wie viele Lieferanten?", text: "Drei." },
        },
      ],
    };
    render(<ThreadView text="Wir suchten einen Lieferanten." thread={thread} />);
    expect(screen.getByText("AI follow-up 1 (answered)")).toBeInTheDocument();
    expect(screen.getByText("AI follow-up 1")).toBeInTheDocument();
    expect(screen.getByText("Welche Quellen?")).toBeInTheDocument();
    expect(screen.getByText("Wie viele Lieferanten?")).toBeInTheDocument();
  });

  it("adds no ‘(answered)’ suffix when a step has only one ask", () => {
    const thread: Thread = {
      max: 2,
      end: "no-call",
      steps: [
        {
          index: 1,
          decisions: [{ decision: "ask", followUp: "Welche Quellen?", reason: "No source is named.", errorClass: null, stale: false }],
          reply: { question: "Welche Quellen?", text: "Im Handelsregister." },
        },
      ],
    };
    render(<ThreadView text="Wir suchten einen Lieferanten." thread={thread} />);
    expect(screen.queryByText(/\(answered\)/)).toBeNull();
    expect(screen.getByText("AI follow-up 1")).toBeInTheDocument();
  });
});
