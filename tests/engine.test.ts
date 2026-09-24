import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import type { Form } from "@/form";
import {
  AnswerValueSchema, activeQuestions, applyAnswer, canProbe, cleanAnswer, isEscape, isSkipped, nextQuestion, previousQuestion,
  progress, pruneSkipped, questionAfter, questionNumber, sameAnswer, validate, wantsEmail,
  type Answers,
} from "@/engine";

const q = (id: string) => FORM.questions.find((x) => x.id === id)!;

const NEVER = { "new-customers": "never", "new-suppliers": "never", "one-company": "never", competitors: "never", "own-position": "never" };

/** The shortest complete path: the case escaped, every activity never. */
const SHORT: Answers = {
  role: { option: "owner" }, size: { option: "1-9" }, customers: { option: "businesses" }, case: { option: "none" },
  pains: { text: "p" }, activities: { rows: NEVER }, who: { option: "me" }, skipped: { options: ["none"] },
  followup: { options: ["neither"] },
};

/** Every screen answered. */
const FULL: Answers = {
  role: { option: "owner" }, size: { option: "1-9" }, customers: { option: "businesses" }, case: { text: "c" },
  duration: { option: "lt2h" }, cost: { options: ["no"] }, result: { option: "yes" }, pains: { text: "p" },
  gains: { text: "g" }, activities: { rows: { ...NEVER, competitors: "monthly" } }, who: { option: "me" },
  skipped: { options: ["none"] }, sources: { options: ["website"] }, followup: { options: ["neither"] },
};

describe("skips", () => {
  it("escaping the case skips duration, cost, result and gains", () => {
    expect(activeQuestions(FORM, { case: { option: "none" } }).map((x) => x.id)).toEqual([
      "role", "size", "customers", "case", "pains", "activities", "who", "skipped", "sources", "followup",
    ]);
  });
  it("never in every activity row skips sources, one other answer keeps it", () => {
    expect(isSkipped(FORM, "sources", { activities: { rows: NEVER } })).toBe(true);
    expect(isSkipped(FORM, "sources", { activities: { rows: { ...NEVER, competitors: "monthly" } } })).toBe(false);
  });
  it("skips nothing otherwise", () => {
    expect(activeQuestions(FORM, FULL).length).toBe(14);
  });
});

describe("nextQuestion / previousQuestion", () => {
  it("starts at role and walks in order", () => {
    expect(nextQuestion(FORM, {})?.id).toBe("role");
    expect(nextQuestion(FORM, { role: { option: "owner" } })?.id).toBe("size");
  });
  it("jumps over skipped questions", () => {
    const answers: Answers = { role: { option: "owner" }, size: { option: "1-9" }, customers: { option: "both" }, case: { option: "none" } };
    expect(nextQuestion(FORM, answers)?.id).toBe("pains");
  });
  it("returns null when everything is answered", () => {
    expect(nextQuestion(FORM, SHORT)).toBeNull();
    expect(nextQuestion(FORM, FULL)).toBeNull();
  });
  it("previous goes back over skipped questions and stops at the first", () => {
    expect(previousQuestion(FORM, { case: { option: "none" } }, "pains")?.id).toBe("case");
    expect(previousQuestion(FORM, { activities: { rows: NEVER } }, "followup")?.id).toBe("skipped");
    expect(previousQuestion(FORM, {}, "role")).toBeNull();
  });
});

describe("progress", () => {
  it("counts active questions only", () => {
    expect(progress(FORM, {})).toEqual({ done: 0, total: 14 });
    expect(progress(FORM, { role: { option: "owner" }, case: { option: "none" } })).toEqual({ done: 2, total: 10 });
    expect(progress(FORM, SHORT)).toEqual({ done: 9, total: 9 });
  });
});

describe("validate", () => {
  it("requires a single choice", () => {
    expect(validate(q("role"), { options: [] }, "en")).toBe("Please choose an answer.");
    expect(validate(q("role"), { option: "owner" }, "en")).toBeNull();
  });
  it("requires a multi choice and keeps each exclusive option alone", () => {
    expect(validate(q("cost"), { options: [] }, "de")).toBe("Bitte wählen Sie eine Antwort.");
    expect(validate(q("cost"), { options: ["no", "paid-report"] }, "en")).toBe("Please choose an answer.");
    expect(validate(q("cost"), { options: ["dont-know"] }, "en")).toBeNull();
    expect(validate(q("cost"), { options: ["paid-report", "outside-help"] }, "en")).toBeNull();
    expect(validate(q("skipped"), { options: ["none", "no-time"] }, "en")).toBe("Please choose an answer.");
  });
  it("requires open text and caps it", () => {
    expect(validate(q("case"), { text: "   " }, "en")).toBe("Please answer this question.");
    expect(validate(q("case"), { text: "a".repeat(4001) }, "en")).toBe("Please shorten your answer to 4,000 characters.");
    expect(validate(q("case"), { text: "I asked a colleague." }, "en")).toBeNull();
  });
  it("accepts the escape on case, nowhere else", () => {
    expect(validate(q("case"), { option: "none" }, "en")).toBeNull();
    expect(validate(q("pains"), { option: "none" }, "en")).toBe("Please answer this question.");
  });
  it("requires every activity row", () => {
    expect(validate(q("activities"), { rows: NEVER }, "en")).toBeNull();
    expect(validate(q("activities"), { rows: { "new-customers": "never" } }, "en")).toBe("Please choose an answer in every row.");
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
    expect(wantsEmail(q("skipped"), ["no-time"])).toBe(false);
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
    expect(cleanAnswer(q("sources"), { options: ["website"], email: "a@b.ch" })).toEqual({ options: ["website"] });
  });
  it("leaves other answers as they are", () => {
    expect(cleanAnswer(q("case"), { text: "  as typed  " })).toEqual({ text: "  as typed  " });
    expect(cleanAnswer(q("role"), { option: "owner" })).toEqual({ option: "owner" });
  });
});

describe("pruneSkipped", () => {
  it("drops answers to questions that are now skipped", () => {
    const answers: Answers = {
      case: { option: "none" }, duration: { option: "lt2h" }, cost: { options: ["no"] }, result: { option: "yes" },
      pains: { text: "p" }, gains: { text: "g" },
    };
    expect(pruneSkipped(FORM, answers)).toEqual({ case: { option: "none" }, pains: { text: "p" } });
  });
  it("keeps everything when nothing is skipped, and does not mutate its input", () => {
    const copy = structuredClone(FULL);
    expect(pruneSkipped(FORM, FULL)).toEqual(copy);
    expect(FULL).toEqual(copy);
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
    const before: Answers = { case: { text: "c" }, duration: { option: "lt2h" }, pains: { text: "p" } };
    expect(applyAnswer(FORM, before, "case", { option: "none" })).toEqual({ case: { option: "none" }, pains: { text: "p" } });
    expect(before.duration).toEqual({ option: "lt2h" });
  });
  it("prunes sources when every activity becomes never", () => {
    const before: Answers = { activities: { rows: { ...NEVER, competitors: "monthly" } }, sources: { options: ["website"] } };
    expect(applyAnswer(FORM, before, "activities", { rows: NEVER })).toEqual({ activities: { rows: NEVER } });
  });
  it("cleans the value it stores", () => {
    expect(applyAnswer(FORM, {}, "followup", { options: ["neither"], email: "a@b.ch" })).toEqual({ followup: { options: ["neither"] } });
  });
  it("rejects an unknown question id", () => {
    expect(() => applyAnswer(FORM, {}, "nope", { text: "x" })).toThrow("unknown question: nope");
  });
});

describe("questionAfter", () => {
  it("walks forward in order, even over answered questions", () => {
    expect(questionAfter(FORM, FULL, "size")?.id).toBe("customers");
  });
  it("jumps over skipped questions", () => {
    expect(questionAfter(FORM, { case: { option: "none" } }, "case")?.id).toBe("pains");
    expect(questionAfter(FORM, { activities: { rows: NEVER } }, "skipped")?.id).toBe("followup");
  });
  it("returns null after the last active question", () => {
    expect(questionAfter(FORM, FULL, "followup")).toBeNull();
  });
});

describe("questionNumber", () => {
  it("numbers active questions from one", () => {
    expect(questionNumber(FORM, {}, "role")).toBe(1);
    expect(questionNumber(FORM, { case: { option: "none" } }, "pains")).toBe(5);
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
