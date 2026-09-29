// The Contacts page: the people who asked to be contacted (the conversation
// or the tool trial in the last question), with their link's tag and e-mail
// address. The only place the results pages show either: the consent text
// promises that answers are evaluated without company names, and that the
// link's company is used only to avoid a second invitation and to reach
// people who wish it (design note §2). Unlike the rest of the results pages,
// a contact does not expire with a form version: every completed response
// counts here, of any form_version, not the current form's only — read with
// the current form's own follow-up question (its id and options are stable
// across versions). Pure function.
import type { ResponseRow, StoredAnswer } from "@/db";
import { AnswerValueSchema } from "@/engine";
import type { Form, Option } from "@/form";
import { referenceCode, SMOKE_TAG } from "@/responses";

export type Contact = { code: string; tag: string | null; email: string | null; openTo: Option[]; completedAt: string };

/** Completed responses, the smoke test's left out, of every form version, oldest first. */
function contactableResponses(responses: ResponseRow[]): ResponseRow[] {
  return responses
    .filter((r) => r.completed_at !== null && r.company_uid !== SMOKE_TAG)
    .sort((a, b) => Date.parse(a.completed_at!) - Date.parse(b.completed_at!));
}

export function contacts(form: Form, responses: ResponseRow[], answers: StoredAnswer[]): Contact[] {
  const question = form.questions.find((q) => q.type === "multi" && q.email !== undefined);
  if (!question || question.type !== "multi") return [];
  const closing = question.exclusive ?? [];
  return contactableResponses(responses).flatMap((response) => {
    const row = answers.find((a) => a.response_id === response.id && a.question_id === question.id && a.followup_index === 0);
    const parsed = AnswerValueSchema.safeParse(row?.value);
    if (!parsed.success || !("options" in parsed.data)) return [];
    const { options, email } = parsed.data;
    const openTo = question.options.filter((o) => options.includes(o.id) && !closing.includes(o.id));
    if (openTo.length === 0) return [];
    return [{ code: referenceCode(response.id), tag: response.company_uid, email: email ?? null, openTo, completedAt: response.completed_at! }];
  });
}
