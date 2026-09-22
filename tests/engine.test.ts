import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import {
  activeQuestions, canProbe, isSkipped, nextQuestion, previousQuestion, progress, validate,
  type Answers,
} from "@/engine";

const q = (id: string) => FORM.questions.find((x) => x.id === id)!;

describe("skips", () => {
  it("skips case and duration when relations is none", () => {
    const answers: Answers = { relations: { options: ["none"] } };
    expect(isSkipped(FORM, "case", answers)).toBe(true);
    expect(isSkipped(FORM, "duration", answers)).toBe(true);
    expect(isSkipped(FORM, "pains", answers)).toBe(false);
    expect(activeQuestions(FORM, answers).map((x) => x.id)).toEqual(["role", "size", "relations", "pains", "gains", "followup"]);
  });
  it("skips nothing otherwise", () => {
    const answers: Answers = { relations: { options: ["customer"] } };
    expect(activeQuestions(FORM, answers).length).toBe(8);
  });
});

describe("nextQuestion / previousQuestion", () => {
  it("starts at role and walks in order", () => {
    expect(nextQuestion(FORM, {})?.id).toBe("role");
    expect(nextQuestion(FORM, { role: { option: "owner" } })?.id).toBe("size");
  });
  it("jumps over skipped questions", () => {
    const answers: Answers = { role: { option: "owner" }, size: { option: "1-9" }, relations: { options: ["none"] } };
    expect(nextQuestion(FORM, answers)?.id).toBe("pains");
  });
  it("returns null when everything is answered", () => {
    const answers: Answers = {
      role: { option: "owner" }, size: { option: "1-9" }, relations: { options: ["none"] },
      pains: { text: "x" }, gains: { text: "y" }, followup: { options: ["neither"] },
    };
    expect(nextQuestion(FORM, answers)).toBeNull();
  });
  it("previous goes back over skipped questions and stops at the first", () => {
    const answers: Answers = { role: { option: "owner" }, size: { option: "1-9" }, relations: { options: ["none"] } };
    expect(previousQuestion(FORM, answers, "pains")?.id).toBe("relations");
    expect(previousQuestion(FORM, answers, "role")).toBeNull();
  });
});

describe("progress", () => {
  it("counts active questions only", () => {
    expect(progress(FORM, {})).toEqual({ done: 0, total: 8 });
    expect(progress(FORM, { role: { option: "owner" }, relations: { options: ["none"] } })).toEqual({ done: 2, total: 6 });
  });
});

describe("validate", () => {
  it("requires a single choice", () => {
    expect(validate(q("role"), { options: [] }, "en")).toBe("Please choose an answer.");
    expect(validate(q("role"), { option: "owner" }, "en")).toBeNull();
  });
  it("requires at least one multi choice and rejects none plus others", () => {
    expect(validate(q("relations"), { options: [] }, "de")).toBe("Bitte wählen Sie eine Antwort.");
    expect(validate(q("relations"), { options: ["none", "customer"] }, "en")).toBe("Please choose an answer.");
    expect(validate(q("relations"), { options: ["customer", "supplier"] }, "en")).toBeNull();
  });
  it("requires open text and caps it", () => {
    expect(validate(q("case"), { text: "   " }, "en")).toBe("Please answer this question.");
    expect(validate(q("case"), { text: "a".repeat(4001) }, "en")).toBe("Please shorten your answer to 4,000 characters.");
    expect(validate(q("case"), { text: "I asked a colleague." }, "en")).toBeNull();
  });
  it("requires a valid e-mail unless neither is chosen", () => {
    expect(validate(q("followup"), { options: ["neither"] }, "en")).toBeNull();
    expect(validate(q("followup"), { options: ["conversation"] }, "en")).toBe("Please enter an e-mail address so that I can reach you.");
    expect(validate(q("followup"), { options: ["conversation"], email: "nope" }, "en")).toBe("This e-mail address does not look right.");
    expect(validate(q("followup"), { options: ["conversation"], email: "a@b.ch" }, "en")).toBeNull();
  });
});

describe("canProbe", () => {
  it("allows up to maxFollowUps on probed questions only", () => {
    expect(canProbe(q("case"), 0)).toBe(true);
    expect(canProbe(q("case"), 1)).toBe(true);
    expect(canProbe(q("case"), 2)).toBe(false);
    expect(canProbe(q("role"), 0)).toBe(false);
  });
});
