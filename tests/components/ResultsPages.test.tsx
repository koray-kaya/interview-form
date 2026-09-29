import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/db", async () => {
  const f = await import("../results-fixture");
  return { readAll: vi.fn(async () => f.rows) };
});
import * as db from "@/db";
import ResultsPage from "@/app/admin/results/page";
import { EMAIL, UID } from "../results-fixture";

const search = (l?: string) => ({ searchParams: Promise.resolve(l ? { l } : {}) });

describe("the results overview", () => {
  it("shows the tiles and all fourteen questions, counts first", async () => {
    render(await ResultsPage(search()));
    expect(screen.getByRole("heading", { level: 1, name: "Survey results — form 2.0.0" })).toBeInTheDocument();
    expect(screen.getByText("Completed").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Your role")).toBeInTheDocument();
    expect(screen.getAllByText("1 / 2 · 50%").length).toBeGreaterThan(0);
  });

  it("links each open question to its answers", async () => {
    render(await ResultsPage(search()));
    const link = screen.getByRole("link", { name: /Think of the last time/ });
    expect(link).toHaveAttribute("href", "/admin/results/open#case");
    expect(link).toHaveTextContent("Read the 1 answer and the AI follow-ups →");
    expect(screen.getByText(/1 answered · 1 chose/)).toBeInTheDocument();
  });

  it("shows the texts participants saw with ?l=de, and keeps it on the links", async () => {
    render(await ResultsPage(search("de")));
    expect(screen.getByText("Ihre Rolle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open answers" })).toHaveAttribute("href", "/admin/results/open?l=de");
  });

  it("never shows a company number or an e-mail address", async () => {
    const { container } = render(await ResultsPage(search()));
    expect(container.textContent).not.toContain(UID);
    expect(container.textContent).not.toContain(EMAIL);
  });

  it("renders before the first completed response, without a Responses tab", async () => {
    vi.mocked(db.readAll).mockResolvedValueOnce({ responses: [], answers: [], probe_calls: [] });
    render(await ResultsPage(search()));
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Responses" })).toBeNull();
    expect(document.body.textContent).not.toContain("NaN");
  });
});
