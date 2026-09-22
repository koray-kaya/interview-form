// The rules of the form as pure functions: which questions are active, which
// comes next, how far along we are, whether an answer is valid, and whether
// the AI may ask a follow-up. No React, no network — everything here is
// unit-tested without a browser.
import type { Form, Question } from "@/form";
import { t, type Lang } from "@/i18n";
import { UI } from "@/texts";

export type AnswerValue =
  | { text: string }
  | { option: string }
  | { options: string[]; email?: string };

export type Answers = Record<string, AnswerValue>;

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
  if (question.email && !(picked.length === 1 && picked[0] === question.email.unlessOption)) {
    const email = "email" in value ? (value.email ?? "").trim() : "";
    if (email.length === 0) return t(UI.emailRequired, lang);
    if (!EMAIL.test(email)) return t(UI.emailInvalid, lang);
  }
  return null;
}

export function canProbe(question: Question, followUpsSoFar: number): boolean {
  return question.type === "open" && question.probe !== undefined && followUpsSoFar < question.probe.maxFollowUps;
}
