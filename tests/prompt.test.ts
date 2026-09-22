import { describe, expect, it } from "vitest";
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
});
