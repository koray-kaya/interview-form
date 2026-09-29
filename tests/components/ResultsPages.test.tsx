import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/db", async () => {
  const f = await import("../results-fixture");
  return { readAll: vi.fn(async () => f.rows) };
});
import * as db from "@/db";
import ResultsPage from "@/app/admin/results/page";
import OpenAnswersPage from "@/app/admin/results/open/page";
import ResponsePage from "@/app/admin/results/[code]/page";
import ContactsPage from "@/app/admin/results/contacts/page";
import { EMAIL, UID } from "../results-fixture";

const search = (l?: string) => ({ searchParams: Promise.resolve(l ? { l } : {}) });
const code = (c: string, l?: string) => ({ params: Promise.resolve({ code: c }), ...search(l) });

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

  it("counts rejected decisions into the errors hint", async () => {
    render(await ResultsPage(search()));
    expect(screen.getByText("3 stops, 0 errors or rejected")).toBeInTheDocument();
  });

  it("renders before the first completed response, without a Responses tab", async () => {
    vi.mocked(db.readAll).mockResolvedValueOnce({ responses: [], answers: [], probe_calls: [] });
    render(await ResultsPage(search()));
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Responses" })).toBeNull();
    expect(document.body.textContent).not.toContain("NaN");
  });
});

describe("the open answers page", () => {
  it("shows each answer with the AI's follow-ups and reasons", async () => {
    render(await OpenAnswersPage(search()));
    expect(screen.getByText("Welche Quellen haben Sie dafür genutzt?")).toBeInTheDocument();
    expect(screen.getByText(/Why: The need is named but no step or source\./)).toBeInTheDocument();
    expect(screen.getAllByText(/the limit of 2 follow-ups was reached/)).toHaveLength(2);
    expect(screen.getByText(/No further question — The answer names a difficulty\. \(made on an earlier version of the answer\)/)).toBeInTheDocument();
    expect(document.getElementById("pains")).not.toBeNull();
  });

  it("shows each question's counts and the case summary line under its heading", async () => {
    render(await OpenAnswersPage(search()));
    const caseSection = document.getElementById("case");
    expect(caseSection?.textContent).toContain("n = 2");
    expect(caseSection?.textContent).toContain(
      "1 answered · 1 chose “I can't think of such a case.” · 1 got an AI follow-up (1 in all)",
    );
  });

  it("shows markup in an answer as text", async () => {
    render(await OpenAnswersPage(search()));
    expect(screen.getByText(/<b>nirgends<\/b> steht es/)).toBeInTheDocument();
  });

  it("never shows a company number or an e-mail address", async () => {
    const { container } = render(await OpenAnswersPage(search()));
    expect(container.textContent).not.toContain(UID);
    expect(container.textContent).not.toContain(EMAIL);
  });
});

describe("the response page", () => {
  it("shows one response in words, with the skipped questions and neighbours", async () => {
    render(await ResponsePage(code("aaaa0002")));
    expect(screen.getByRole("heading", { name: "Response aaaa0002" })).toBeInTheDocument();
    expect(screen.getAllByText(/question 4 was answered “I can't think of such a case\.”/).length).toBe(4);
    expect(screen.getByText(/every row of question 10 was “Never”/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "← previous" })[0]).toHaveAttribute("href", "/admin/results/aaaa0001");
  });

  it("never shows a company number or an e-mail address", async () => {
    for (const c of ["aaaa0001", "aaaa0002"]) {
      const { container, unmount } = render(await ResponsePage(code(c)));
      expect(container.textContent).not.toContain(UID);
      expect(container.textContent).not.toContain(EMAIL);
      unmount();
    }
  });

  it("gives 404 for a malformed code without reading the database", async () => {
    vi.mocked(db.readAll).mockClear();
    for (const c of ["AAAA0002", "aaaa0002x", "../x"]) {
      await expect(ResponsePage(code(c))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(db.readAll).not.toHaveBeenCalled();
  });

  it("gives 404 for a code that is not a counted response", async () => {
    await expect(ResponsePage(code("aaaa0003"))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("the contacts page", () => {
  it("lists the people who asked to be contacted, with company number and e-mail", async () => {
    render(await ContactsPage(search()));
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute("href", `mailto:${EMAIL}`);
    expect(screen.getByText(UID)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "aaaa0001" })).toHaveAttribute("href", "/admin/results/aaaa0001");
    expect(screen.queryByText("aaaa0002")).toBeNull();
  });

  it("is not printed", async () => {
    const { container } = render(await ContactsPage(search()));
    expect(container.querySelector("table")?.closest(".print\\:hidden")).not.toBeNull();
  });
});
