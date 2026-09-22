import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import { loadPrompt } from "@/prompt";

describe("loadPrompt", () => {
  it("reads the version and the instructions from prompts/probe.md", () => {
    const prompt = loadPrompt();
    expect(prompt.version).toBe("1");
    expect(prompt.text).not.toMatch(/^version:/);
    for (const rule of ["Exactly one question", "Never mention or suggest a tool", "Never ask about time", "<answer>"]) {
      expect(prompt.text).toContain(rule);
    }
  });

  it("lists every probed question with the same text and missing element as form.ts", () => {
    const { text } = loadPrompt();
    const probed = FORM.questions.filter((q) => q.type === "open" && q.probe);
    expect(probed.length).toBe(3);
    for (const q of probed) {
      if (q.type !== "open" || !q.probe) continue;
      expect(text).toContain(`| \`${q.id}\` — ${q.text.en} | ${q.probe.missing.en} |`);
    }
  });
});
