import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Welcome } from "@/components/Welcome";
import { FORM } from "@/form";
import { UI } from "@/texts";

const welcome = (lang: "de" | "en") => render(<Welcome lang={lang} onLang={() => {}} onStart={async () => null} />);

describe("Welcome", () => {
  it.each(["de", "en"] as const)("names no processor (%s)", (lang) => {
    const { container } = welcome(lang);
    expect(container.textContent).not.toMatch(/Anthropic|Vercel|Supabase|OpenAI|Claude/);
  });

  it("keeps the data-protection details behind a closed fold", () => {
    const { container } = welcome("en");
    const fold = container.querySelector("details");
    expect(fold).not.toBeNull();
    expect(fold).not.toHaveAttribute("open");
    expect(fold?.querySelector("summary")).toHaveTextContent("Details");
    expect(fold).toHaveTextContent("koray.kaya@ost.ch");
  });

  it.each(["de", "en"] as const)("promises as many questions as the form has (%s)", (lang) => {
    expect(UI.howLong[lang]).toMatch(new RegExp(`^${FORM.questions.length} `));
  });

  it.each(["de", "en"] as const)("claims nothing about where answers are stored (%s)", (lang) => {
    // decided 2026-09-24: the export goes to Vercel Blob and the model runs abroad
    expect(UI.details[lang]).not.toMatch(/Schweiz|Switzerland|gespeichert|stored/);
  });

  it("says a written answer may get one or two follow-up questions, as maxFollowUps allows", () => {
    expect(UI.promise.de).toContain("ein oder zwei kurze Rückfragen");
    expect(UI.promise.en).toContain("one or two short follow-up questions");
  });
});
