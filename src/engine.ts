// The rules of the form as pure functions: which questions are active, which
// comes next, how far along we are, whether an answer is valid, what a stored
// answer may contain, and whether the AI may ask a follow-up. No React, no
// network — the browser (M1) and the server (M2) both call these, so the two
// can never disagree. Zod describes the shape of an answer, for data that
// arrives from outside (localStorage now, request bodies in M2). Everything
// here is unit-tested without a browser.
import { z } from "zod";
import type { Form, Question } from "@/form";
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

/** One answer: free text, one option, or several options (plus an e-mail). */
export const AnswerValueSchema = z.union([
  z.object({ text: z.string() }),
  z.object({ option: z.string() }),
  z.object({ options: z.array(z.string()), email: z.string().optional() }),
]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

/** All answers so far, keyed by question id. */
export const AnswersSchema = z.record(z.string(), AnswerValueSchema);
export type Answers = z.infer<typeof AnswersSchema>;

function chosen(value: AnswerValue | undefined): string[] {
  if (!value) return [];
  if ("option" in value) return [value.option];
  if ("options" in value) return value.options;
  return [];
}

export function isSkipped(form: Form, questionId: string, answers: Answers): boolean {
  return form.skips.some(
    (rule) => rule.skip.includes(questionId) && chosen(answers[rule.when.question]).includes(rule.when.is),
  );
}

export function activeQuestions(form: Form, answers: Answers): Question[] {
  return form.questions.filter((q) => !isSkipped(form, q.id, answers));
}

export function nextQuestion(form: Form, answers: Answers): Question | null {
  return activeQuestions(form, answers).find((q) => answers[q.id] === undefined) ?? null;
}

export function previousQuestion(form: Form, answers: Answers, currentId: string): Question | null {
  const active = activeQuestions(form, answers);
  const index = active.findIndex((q) => q.id === currentId);
  return index > 0 ? active[index - 1] : null;
}

export function progress(form: Form, answers: Answers): { done: number; total: number } {
  const active = activeQuestions(form, answers);
  return { done: active.filter((q) => answers[q.id] !== undefined).length, total: active.length };
}

/** Whether this question needs an e-mail address for the options chosen. */
export function wantsEmail(question: Question, options: string[]): boolean {
  if (question.type !== "multi" || !question.email || options.length === 0) return false;
  return !(options.length === 1 && options[0] === question.email.unlessOption);
}

/**
 * The value as it may be stored. Drops an e-mail address the question does not
 * need — typed and then opted out of, it must not be kept.
 */
export function cleanAnswer(question: Question, value: AnswerValue): AnswerValue {
  if (!("options" in value)) return value;
  const email = value.email?.trim() ?? "";
  if (wantsEmail(question, value.options) && email.length > 0) return { options: value.options, email };
  return { options: value.options };
}

/**
 * Drops the answers to questions that are skipped. One pass in form order:
 * a rule only sees answers already kept, so an answer that is itself skipped
 * triggers nothing. Relies on every rule looking back (tested in form.test.ts).
 */
export function pruneSkipped(form: Form, answers: Answers): Answers {
  const kept: Answers = {};
  for (const q of form.questions) {
    const value = answers[q.id];
    if (value !== undefined && !isSkipped(form, q.id, kept)) kept[q.id] = value;
  }
  return kept;
}

/**
 * The single way an answer enters the answer set: cleaned, stored under its
 * question, then everything it skips removed. Returns a new object.
 */
export function applyAnswer(form: Form, answers: Answers, questionId: string, value: AnswerValue): Answers {
  const question = form.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`unknown question: ${questionId}`);
  return pruneSkipped(form, { ...answers, [questionId]: cleanAnswer(question, value) });
}

/** The active question after this one, answered or not; null after the last. */
export function questionAfter(form: Form, answers: Answers, currentId: string): Question | null {
  const active = activeQuestions(form, answers);
  const index = active.findIndex((q) => q.id === currentId);
  return index >= 0 && index + 1 < active.length ? active[index + 1] : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(question: Question, value: AnswerValue, lang: Lang): string | null {
  if (question.type === "open") {
    const text = "text" in value ? value.text.trim() : "";
    if (text.length === 0) return t(UI.required, lang);
    if (text.length > question.maxChars) return t(UI.tooLong, lang);
    return null;
  }
  const picked = chosen(value);
  if (picked.length === 0) return t(UI.chooseOne, lang);
  if (question.type === "single") return null;
  if (question.exclusive && picked.includes(question.exclusive) && picked.length > 1) return t(UI.chooseOne, lang);
  if (wantsEmail(question, picked)) {
    const email = "email" in value ? (value.email ?? "").trim() : "";
    if (email.length === 0) return t(UI.emailRequired, lang);
    if (!EMAIL.test(email)) return t(UI.emailInvalid, lang);
  }
  return null;
}

export function canProbe(question: Question, followUpsSoFar: number): boolean {
  return question.type === "open" && question.probe !== undefined && followUpsSoFar < question.probe.maxFollowUps;
}
