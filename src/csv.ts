// The export as one table for analysis: one row per completed response, one
// column per answer. The database keeps answers as rows (one per question and
// follow-up); this turns them into what a spreadsheet or SPSS expects. Choices
// are written as their ids ("owner", "monthly"); the form in the JSON export
// turns them back into words. An empty cell is a question the participant's
// path skipped. The e-mail address is left out: it is for contacting people,
// not for analysis. Plain TypeScript, no library.
import { AnswerValueSchema, type AnswerValue } from "@/engine";
import type { Form } from "@/form";
import { referenceCode } from "@/responses";

export type CsvResponse = {
  id: string;
  company_uid: string | null;
  lang: string;
  form_version: string;
  created_at: string;
  completed_at: string | null;
};

export type CsvAnswer = {
  response_id: string;
  question_id: string;
  followup_index: number;
  question_text: string;
  value: AnswerValue;
};

type Column = { name: string; cell: (own: CsvAnswer[]) => string };

const fixed = (own: CsvAnswer[], questionId: string): AnswerValue | undefined => {
  const row = own.find((a) => a.question_id === questionId && a.followup_index === 0);
  const parsed = AnswerValueSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : undefined;
};

const followUp = (own: CsvAnswer[], questionId: string, index: number): CsvAnswer | undefined =>
  own.find((a) => a.question_id === questionId && a.followup_index === index);

const text = (value: AnswerValue | undefined): string => (value && "text" in value ? value.text : "");

/** The columns of one question, in form order. */
function columnsOf(question: Form["questions"][number]): Column[] {
  const id = question.id;
  if (question.type === "single") {
    return [{ name: id, cell: (own) => { const v = fixed(own, id); return v && "option" in v ? v.option : ""; } }];
  }
  if (question.type === "multi") {
    return question.options.map((option) => ({
      name: `${id}.${option.id}`,
      cell: (own) => {
        const v = fixed(own, id);
        if (!v || !("options" in v)) return "";
        return v.options.includes(option.id) ? "1" : "0";
      },
    }));
  }
  if (question.type === "rows") {
    return question.rows.map((row) => ({
      name: `${id}.${row.id}`,
      cell: (own) => { const v = fixed(own, id); return v && "rows" in v ? (v.rows[row.id] ?? "") : ""; },
    }));
  }
  const columns: Column[] = [{ name: id, cell: (own) => text(fixed(own, id)) }];
  const escape = question.escape;
  if (escape) {
    columns.push({
      name: `${id}.escaped`,
      cell: (own) => {
        const v = fixed(own, id);
        if (!v) return "";
        return "option" in v && v.option === escape.id ? "1" : "0";
      },
    });
  }
  for (let index = 1; index <= (question.probe?.maxFollowUps ?? 0); index++) {
    columns.push(
      { name: `${id}.followup${index}.question`, cell: (own) => followUp(own, id, index)?.question_text ?? "" },
      { name: `${id}.followup${index}.answer`, cell: (own) => text(followUp(own, id, index)?.value) },
    );
  }
  return columns;
}

/** Quotes a cell when it holds a comma, a quote or a line break (RFC 4180). */
function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function minutes(from: string, to: string): string {
  return String(Math.round((Date.parse(to) - Date.parse(from)) / 6_000) / 10);
}

/**
 * One row per response that is completed and was answered on this form's
 * version. Starts with a byte-order mark and uses CRLF line ends, so Excel
 * reads the umlauts and the rows correctly.
 */
export function toCsv(form: Form, responses: CsvResponse[], answers: CsvAnswer[]): string {
  const columns = form.questions.flatMap(columnsOf);
  const header = ["reference", "company_uid", "lang", "started_at", "completed_at", "minutes", ...columns.map((c) => c.name)];
  const lines = responses
    .filter((r) => r.completed_at !== null && r.form_version === form.version)
    .map((r) => {
      const own = answers.filter((a) => a.response_id === r.id);
      return [
        referenceCode(r.id), r.company_uid ?? "", r.lang, r.created_at, r.completed_at ?? "",
        minutes(r.created_at, r.completed_at!),
        ...columns.map((c) => c.cell(own)),
      ];
    });
  return "﻿" + [header, ...lines].map((cells) => cells.map(quote).join(",")).join("\r\n") + "\r\n";
}
