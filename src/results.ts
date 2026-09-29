// What the results pages show, computed from the rows of the three tables:
// which responses count, n and the counts per question, the tiles, the open
// answers with their threads, and one response in words (design note
// docs/design/2026-09-28-results-dashboard.md §2–§4). Pure functions, tested
// without a database. What the pages render from here — the counts, tiles,
// open answers and response view — carries no company number and no e-mail
// address. countedResponses hands back the raw rows; only contacts.ts reads
// their company number.
import type { ResponseRow, StoredAnswer, StoredCall } from "@/db";
import { AnswerValueSchema, holds, type AnswerValue, type Answers } from "@/engine";
import type { Form, MultiQuestion, OpenQuestion, Option, Question, RowsQuestion, SingleQuestion } from "@/form";
import type { Lang } from "@/i18n";
import { fixedAnswers, referenceCode, SMOKE_TAG } from "@/responses";
import { median } from "@/stats";
import { buildThread, type Thread } from "@/threads";

export type Rows = { responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] };

/** ?l=de shows the texts participants saw; anything else is English. */
export function resultsLang(value: string | string[] | undefined): Lang {
  return value === "de" ? "de" : "en";
}

/** A results link that keeps the language of the question texts. */
export function withLang(path: string, lang: Lang): string {
  return lang === "de" ? `${path}?l=de` : path;
}

export function percent(count: number, n: number): number {
  return n === 0 ? 0 : Math.round((count / n) * 100);
}

/** The count first, the share second: with a small n a share alone misleads. */
export function shareLabel(count: number, n: number): string {
  return n === 0 ? "0 / 0" : `${count} / ${n} · ${percent(count, n)}%`;
}

/**
 * Completed responses of this form version, without the smoke test's, in
 * order of completion. Raw rows, company number included: for filtering and
 * for contacts.ts, never for rendering.
 */
export function countedResponses(form: Form, responses: ResponseRow[]): ResponseRow[] {
  return responses
    .filter((r) => r.completed_at !== null && r.form_version === form.version && r.company_uid !== SMOKE_TAG)
    .sort((a, b) => Date.parse(a.completed_at!) - Date.parse(b.completed_at!));
}

/** The reference code the Responses tab opens, or null before the first completion. */
export function firstCode(form: Form, rows: Rows): string | null {
  const first = countedResponses(form, rows.responses)[0];
  return first ? referenceCode(first.id) : null;
}

/** An option, escape option, scale step or row of a question, by id. */
export function optionOf(question: Question, id: string): Option | undefined {
  if (question.type === "open") return question.escape?.id === id ? question.escape : undefined;
  if (question.type === "rows") return question.scale.find((o) => o.id === id) ?? question.rows.find((o) => o.id === id);
  return question.options.find((o) => o.id === id);
}

const minutes = (r: ResponseRow) => (Date.parse(r.completed_at!) - Date.parse(r.created_at)) / 60_000;
const chosen = (v: AnswerValue): string[] => ("option" in v ? [v.option] : "options" in v ? v.options : []);
const withoutEmail = (v: AnswerValue): AnswerValue => ("options" in v ? { options: v.options } : v);

/** The counted responses, their ids, and the answer rows that belong to them. */
function counted(form: Form, rows: Rows) {
  const responses = countedResponses(form, rows.responses);
  const ids = new Set(responses.map((r) => r.id));
  return { responses, ids, answers: rows.answers.filter((a) => ids.has(a.response_id)) };
}

export type OptionCount = { option: Option; count: number };

export type QuestionResult =
  | { type: "single" | "multi"; number: number; question: SingleQuestion | MultiQuestion; n: number; counts: OptionCount[] }
  | { type: "rows"; number: number; question: RowsQuestion; n: number; rows: { row: Option; counts: OptionCount[] }[] }
  | { type: "open"; number: number; question: OpenQuestion; n: number; written: number; escaped: number; followedUp: number; followUps: number };

export function questionResults(form: Form, rows: Rows): QuestionResult[] {
  const { responses, answers } = counted(form, rows);
  const fixed = responses.map((r) => fixedAnswers(answers.filter((a) => a.response_id === r.id)));
  return form.questions.map((question, i): QuestionResult => {
    const number = i + 1;
    const values = fixed.map((f) => f[question.id]).filter((v): v is AnswerValue => v !== undefined);
    const n = values.length;
    if (question.type === "single" || question.type === "multi") {
      const picks = values.map(chosen);
      return { type: question.type, number, question, n, counts: question.options.map((option) => ({ option, count: picks.filter((p) => p.includes(option.id)).length })) };
    }
    if (question.type === "rows") {
      return {
        type: "rows", number, question, n,
        rows: question.rows.map((row) => ({
          row,
          counts: question.scale.map((option) => ({ option, count: values.filter((v) => "rows" in v && v.rows[row.id] === option.id).length })),
        })),
      };
    }
    const escaped = values.filter((v) => "option" in v).length;
    const replies = answers.filter((a) => a.question_id === question.id && a.followup_index > 0);
    return {
      type: "open", number, question, n, written: n - escaped, escaped,
      followedUp: new Set(replies.map((a) => a.response_id)).size,
      followUps: replies.length,
    };
  });
}

export type Tiles = { completed: number; medianMinutes: number | null; followUps: number; calls: number; stops: number; errors: number };

export function tiles(form: Form, rows: Rows): Tiles {
  const { responses, ids, answers } = counted(form, rows);
  const calls = rows.probe_calls.filter((c) => ids.has(c.response_id));
  return {
    completed: responses.length,
    medianMinutes: median(responses.map(minutes)),
    followUps: answers.filter((a) => a.followup_index > 0).length,
    calls: calls.length,
    stops: calls.filter((c) => c.decision === "stop").length,
    errors: calls.filter((c) => c.decision === "error" || c.decision === "rejected").length,
  };
}

export type OpenEntry = { code: string; value: AnswerValue; thread: Thread | null };
export type OpenSection = { number: number; question: OpenQuestion; entries: OpenEntry[] };

function openEntry(question: OpenQuestion, response: ResponseRow, rows: Rows): OpenEntry | null {
  const own = rows.answers.filter((a) => a.response_id === response.id && a.question_id === question.id);
  const main = own.find((a) => a.followup_index === 0);
  const parsed = AnswerValueSchema.safeParse(main?.value);
  if (!main || !parsed.success) return null;
  const calls = rows.probe_calls.filter((c) => c.response_id === response.id && c.question_id === question.id);
  const thread = "text" in parsed.data
    ? buildThread(main, own.filter((a) => a.followup_index > 0), calls, question.probe?.maxFollowUps ?? 0)
    : null;
  return { code: referenceCode(response.id), value: parsed.data, thread };
}

export function openAnswers(form: Form, rows: Rows): OpenSection[] {
  const responses = countedResponses(form, rows.responses);
  return form.questions.flatMap((question, i) =>
    question.type !== "open"
      ? []
      : [{
          number: i + 1,
          question,
          entries: responses.flatMap((r) => {
            const entry = openEntry(question, r, rows);
            return entry ? [entry] : [];
          }),
        }],
  );
}

export type SkipReason = { number: number; kind: "is" | "every"; option: Option };

export type ResponseItem =
  | { number: number; question: Question; state: "skipped"; because: SkipReason | null }
  | { number: number; question: Question; state: "answered"; value: AnswerValue; thread: Thread | null };

export type ResponseView = {
  code: string; position: number; total: number; previous: string | null; next: string | null;
  lang: Lang; minutes: number; followUps: number; items: ResponseItem[];
};

function skipReason(form: Form, questionId: string, answers: Answers): SkipReason | null {
  const rule = form.skips.find((s) => s.skip.includes(questionId) && holds(s.when, answers));
  if (!rule) return null;
  const index = form.questions.findIndex((q) => q.id === rule.when.question);
  const kind = "is" in rule.when ? "is" : "every";
  const option = optionOf(form.questions[index], "is" in rule.when ? rule.when.is : rule.when.every);
  return option ? { number: index + 1, kind, option } : null;
}

export function responseView(form: Form, rows: Rows, code: string): ResponseView | null {
  const responses = countedResponses(form, rows.responses);
  const index = responses.findIndex((r) => referenceCode(r.id) === code);
  if (index === -1) return null;
  const response = responses[index];
  const own = rows.answers.filter((a) => a.response_id === response.id);
  const fixed = fixedAnswers(own);
  const items = form.questions.map((question, i): ResponseItem => {
    const value = fixed[question.id];
    if (value === undefined) return { number: i + 1, question, state: "skipped", because: skipReason(form, question.id, fixed) };
    const thread = question.type === "open" ? (openEntry(question, response, rows)?.thread ?? null) : null;
    return { number: i + 1, question, state: "answered", value: withoutEmail(value), thread };
  });
  return {
    code,
    position: index + 1,
    total: responses.length,
    previous: index > 0 ? referenceCode(responses[index - 1].id) : null,
    next: index < responses.length - 1 ? referenceCode(responses[index + 1].id) : null,
    lang: response.lang,
    minutes: Math.round(minutes(response)),
    followUps: own.filter((a) => a.followup_index > 0).length,
    items,
  };
}
