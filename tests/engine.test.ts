import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import type { Form } from "@/form";
import {
  AnswerValueSchema, activeQuestions, applyAnswer, canProbe, cleanAnswer, isEscape, isSkipped, nextQuestion, previousQuestion,
  progress, pruneSkipped, questionAfter, questionNumber, sameAnswer, validate, wantsEmail,
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

describe("wantsEmail", () => {
  it("asks for an e-mail unless only the opt-out is chosen", () => {
    expect(wantsEmail(q("followup"), ["conversation"])).toBe(true);
    expect(wantsEmail(q("followup"), ["conversation", "trial"])).toBe(true);
    expect(wantsEmail(q("followup"), ["neither"])).toBe(false);
    expect(wantsEmail(q("followup"), [])).toBe(false);
    expect(wantsEmail(q("relations"), ["customer"])).toBe(false);
  });
});

describe("cleanAnswer", () => {
  it("drops the e-mail when the participant opted out", () => {
    expect(cleanAnswer(q("followup"), { options: ["neither"], email: "a@b.ch" })).toEqual({ options: ["neither"] });
  });
  it("keeps a trimmed e-mail when contact is wanted", () => {
    expect(cleanAnswer(q("followup"), { options: ["conversation"], email: " a@b.ch " })).toEqual({ options: ["conversation"], email: "a@b.ch" });
  });
  it("drops an e-mail on a question that never asks for one", () => {
    expect(cleanAnswer(q("relations"), { options: ["customer"], email: "a@b.ch" })).toEqual({ options: ["customer"] });
  });
  it("leaves other answers as they are", () => {
    expect(cleanAnswer(q("case"), { text: "  as typed  " })).toEqual({ text: "  as typed  " });
    expect(cleanAnswer(q("role"), { option: "owner" })).toEqual({ option: "owner" });
  });
});

describe("pruneSkipped", () => {
  it("drops answers to questions that are now skipped", () => {
    const answers: Answers = {
      relations: { options: ["none"] }, case: { text: "old case" }, duration: { option: "lt2h" }, pains: { text: "p" },
    };
    expect(pruneSkipped(FORM, answers)).toEqual({ relations: { options: ["none"] }, pains: { text: "p" } });
  });
  it("keeps everything when nothing is skipped, and does not mutate its input", () => {
    const answers: Answers = { relations: { options: ["customer"] }, case: { text: "c" } };
    const copy = structuredClone(answers);
    expect(pruneSkipped(FORM, answers)).toEqual(copy);
    expect(answers).toEqual(copy);
  });
  it("follows chains: a skipped answer no longer triggers the rules that depend on it", () => {
    const opt = (id: string) => ({ id, label: { de: id, en: id } });
    const chain: Form = {
      version: "0.0.0",
      questions: [
        { id: "a", type: "single", text: { de: "a", en: "a" }, options: [opt("yes"), opt("no")] },
        { id: "b", type: "single", text: { de: "b", en: "b" }, options: [opt("x"), opt("y")] },
        { id: "c", type: "open", text: { de: "c", en: "c" }, maxChars: 10 },
      ],
      skips: [
        { when: { question: "a", is: "no" }, skip: ["b"] },
        { when: { question: "b", is: "x" }, skip: ["c"] },
      ],
    };
    const answers: Answers = { a: { option: "no" }, b: { option: "x" }, c: { text: "kept" } };
    expect(pruneSkipped(chain, answers)).toEqual({ a: { option: "no" }, c: { text: "kept" } });
  });
});

describe("applyAnswer", () => {
  it("stores the cleaned answer and prunes what it skips", () => {
    const before: Answers = { relations: { options: ["customer"] }, case: { text: "c" }, duration: { option: "lt2h" } };
    expect(applyAnswer(FORM, before, "relations", { options: ["none"] })).toEqual({ relations: { options: ["none"] } });
    expect(before.case).toEqual({ text: "c" });
  });
  it("cleans the value it stores", () => {
    expect(applyAnswer(FORM, {}, "followup", { options: ["neither"], email: "a@b.ch" })).toEqual({ followup: { options: ["neither"] } });
  });
  it("rejects an unknown question id", () => {
    expect(() => applyAnswer(FORM, {}, "nope", { text: "x" })).toThrow("unknown question: nope");
  });
});

describe("questionAfter", () => {
  const all: Answers = {
    role: { option: "owner" }, size: { option: "1-9" }, relations: { options: ["customer"] }, case: { text: "c" },
    duration: { option: "lt2h" }, pains: { text: "p" }, gains: { text: "g" }, followup: { options: ["neither"] },
  };
  it("walks forward in order, even over answered questions", () => {
    expect(questionAfter(FORM, all, "size")?.id).toBe("relations");
  });
  it("jumps over skipped questions", () => {
    expect(questionAfter(FORM, { relations: { options: ["none"] } }, "relations")?.id).toBe("pains");
  });
  it("returns null after the last active question", () => {
    expect(questionAfter(FORM, all, "followup")).toBeNull();
  });
});

describe("questionNumber", () => {
  it("numbers active questions from one", () => {
    expect(questionNumber(FORM, {}, "role")).toBe(1);
    expect(questionNumber(FORM, { relations: { options: ["none"] } }, "pains")).toBe(4);
  });
});

describe("sameAnswer", () => {
  it("ignores key order, as a database may reorder JSON keys", () => {
    expect(sameAnswer({ options: ["conversation"], email: "a@b.ch" }, { email: "a@b.ch", options: ["conversation"] } as never)).toBe(true);
  });
  it("sees a changed value, a changed option order and a changed type", () => {
    expect(sameAnswer({ text: "a" }, { text: "b" })).toBe(false);
    expect(sameAnswer({ options: ["customer", "supplier"] }, { options: ["supplier", "customer"] })).toBe(false);
    expect(sameAnswer({ option: "a" }, { options: ["a"] })).toBe(false);
  });
});

const opt = (id: string) => ({ id, label: { de: id, en: id } });
const words = (s: string) => ({ de: s, en: s });

/** A small form with the rules form 2.0 needs, independent of the real questions. */
const RULES: Form = {
  version: "0.0.0",
  questions: [
    { id: "story", type: "open", text: words("story"), maxChars: 20, escape: opt("none") },
    { id: "spent", type: "multi", text: words("spent"), options: [opt("no"), opt("paid"), opt("help"), opt("unsure")], exclusive: ["no", "unsure"] },
    { id: "plain", type: "open", text: words("plain"), maxChars: 20 },
  ],
  skips: [{ when: { question: "story", is: "none" }, skip: ["spent"] }],
};
const r = (id: string) => RULES.questions.find((x) => x.id === id)!;

describe("the escape", () => {
  it("is a valid answer to an open question that offers it", () => {
    expect(validate(r("story"), { option: "none" }, "en")).toBeNull();
    expect(isEscape(r("story"), { option: "none" })).toBe(true);
  });
  it("is refused where it is not offered, and so is any other option", () => {
    expect(validate(r("plain"), { option: "none" }, "en")).toBe("Please answer this question.");
    expect(validate(r("story"), { option: "other" }, "en")).toBe("Please answer this question.");
    expect(isEscape(r("plain"), { option: "none" })).toBe(false);
    expect(isEscape(r("story"), { text: "none" })).toBe(false);
    expect(isEscape(r("story"), undefined)).toBe(false);
  });
  it("skips what its rule names, and writing an answer after all brings it back", () => {
    const escaped = applyAnswer(RULES, { story: { text: "x" }, spent: { options: ["no"] } }, "story", { option: "none" });
    expect(escaped).toEqual({ story: { option: "none" } });
    expect(isSkipped(RULES, "spent", escaped)).toBe(true);
    const told = applyAnswer(RULES, escaped, "story", { text: "We asked around." });
    expect(nextQuestion(RULES, told)?.id).toBe("spent");
  });
});

describe("several exclusive options", () => {
  it("allows each exclusive option alone, never with another", () => {
    expect(validate(r("spent"), { options: ["no"] }, "en")).toBeNull();
    expect(validate(r("spent"), { options: ["unsure"] }, "en")).toBeNull();
    expect(validate(r("spent"), { options: ["paid", "help"] }, "en")).toBeNull();
    expect(validate(r("spent"), { options: ["no", "paid"] }, "en")).toBe("Please choose an answer.");
    expect(validate(r("spent"), { options: ["no", "unsure"] }, "en")).toBe("Please choose an answer.");
  });
});

describe("validate refuses what the question does not offer", () => {
  it("an unknown option, a repeated option, or the wrong shape", () => {
    expect(validate(r("spent"), { options: ["gold"] }, "en")).toBe("Please choose an answer.");
    expect(validate(r("spent"), { options: ["paid", "paid"] }, "en")).toBe("Please choose an answer.");
    expect(validate(r("spent"), { option: "paid" }, "en")).toBe("Please choose an answer.");
    expect(validate(q("role"), { option: "ceo" }, "en")).toBe("Please choose an answer.");
    expect(validate(q("role"), { options: ["owner"] }, "en")).toBe("Please choose an answer.");
  });
});

/** One rows question and a question it can skip, independent of the real form. */
const OFTEN: Form = {
  version: "0.0.0",
  questions: [
    { id: "often", type: "rows", text: words("often"), rows: [opt("buy"), opt("sell")], scale: [opt("never"), opt("monthly")] },
    { id: "where", type: "multi", text: words("where"), options: [opt("web"), opt("phone")] },
  ],
  skips: [{ when: { question: "often", every: "never" }, skip: ["where"] }],
};
const often = OFTEN.questions[0];

describe("rows", () => {
  it("wants one point of the scale in every row, and nothing else", () => {
    const every = "Please choose an answer in every row.";
    expect(validate(often, { rows: { buy: "never", sell: "monthly" } }, "en")).toBeNull();
    expect(validate(often, { rows: { buy: "never" } }, "en")).toBe(every);
    expect(validate(often, { rows: { buy: "never", sell: "daily" } }, "en")).toBe(every);
    expect(validate(often, { rows: { buy: "never", sell: "never", rent: "never" } }, "en")).toBe(every);
    expect(validate(often, { options: ["never"] }, "en")).toBe(every);
  });
  it("parses as an answer value", () => {
    expect(AnswerValueSchema.safeParse({ rows: { buy: "never" } }).success).toBe(true);
    expect(AnswerValueSchema.safeParse({ rows: { buy: 3 } }).success).toBe(false);
  });
});

describe("a rule on every value", () => {
  it("holds when every row has the value, not when one differs or nothing is answered", () => {
    expect(isSkipped(OFTEN, "where", { often: { rows: { buy: "never", sell: "never" } } })).toBe(true);
    expect(isSkipped(OFTEN, "where", { often: { rows: { buy: "never", sell: "monthly" } } })).toBe(false);
    expect(isSkipped(OFTEN, "where", {})).toBe(false);
  });
  it("prunes the answer it skips", () => {
    const before: Answers = { often: { rows: { buy: "monthly", sell: "never" } }, where: { options: ["web"] } };
    const all = { rows: { buy: "never", sell: "never" } };
    expect(applyAnswer(OFTEN, before, "often", all)).toEqual({ often: all });
  });
});

describe("sameAnswer inside rows", () => {
  it("ignores key order inside rows, as Postgres jsonb reorders keys", () => {
    expect(sameAnswer({ rows: { "new-customers": "never", competitors: "weekly" } }, { rows: { competitors: "weekly", "new-customers": "never" } })).toBe(true);
    expect(sameAnswer({ rows: { a: "never" } }, { rows: { a: "weekly" } })).toBe(false);
  });
});
