import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import { loadPrompt } from "@/prompt";

const probed = FORM.questions.filter((q) => q.type === "open" && q.probe);

describe("loadPrompt", () => {
  it("has one prompt file per probed question", () => {
    expect(probed.map((q) => q.id)).toEqual(["case", "pains", "gains"]);
  });

  it.each(probed.map((q) => [q.id, q] as const))("reads prompts/probe-%s.md", (id, question) => {
    const prompt = loadPrompt(id);
    expect(prompt.version).toMatch(/^\d+$/);
    expect(prompt.text).not.toMatch(/^(version|question):/m);
    // the prompt quotes the question exactly as the form asks it (English wording)
    const quoted = prompt.text.replace(/\s+/g, " ");
    expect(quoted).toContain(question.text.en);
    // the parts every follow-up relies on
    for (const part of ["## This question", "## Writing the follow-up", "<answer>", "`missing`", "`followUp`", "`reason`"]) {
      expect(prompt.text).toContain(part);
    }
  });

  it("refuses a question without a prompt file", () => {
    expect(() => loadPrompt("role")).toThrow();
  });
});
