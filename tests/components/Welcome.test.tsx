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
});
