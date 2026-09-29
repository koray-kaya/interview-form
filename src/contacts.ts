// The Contacts page: the people who asked to be contacted (the conversation
// or the tool trial in the last question), with their link's tag and e-mail
// address. The only place the results pages show either: the consent text
// promises that answers are evaluated without company names, and that the
// link's company is used only to avoid a second invitation and to reach
// people who wish it (design note §2). Pure function.
import type { ResponseRow, StoredAnswer } from "@/db";
import { AnswerValueSchema } from "@/engine";
import type { Form, Option } from "@/form";
import { referenceCode } from "@/responses";
import { countedResponses } from "@/results";

export type Contact = { code: string; tag: string | null; email: string | null; openTo: Option[]; completedAt: string };

export function contacts(form: Form, responses: ResponseRow[], answers: StoredAnswer[]): Contact[] {
  const question = form.questions.find((q) => q.type === "multi" && q.email !== undefined);
  if (!question || question.type !== "multi") return [];
  const closing = question.exclusive ?? [];
  return countedResponses(form, responses).flatMap((response) => {
    const row = answers.find((a) => a.response_id === response.id && a.question_id === question.id && a.followup_index === 0);
    const parsed = AnswerValueSchema.safeParse(row?.value);
    if (!parsed.success || !("options" in parsed.data)) return [];
    const { options, email } = parsed.data;
    const openTo = question.options.filter((o) => options.includes(o.id) && !closing.includes(o.id));
    if (openTo.length === 0) return [];
    return [{ code: referenceCode(response.id), tag: response.company_uid, email: email ?? null, openTo, completedAt: response.completed_at! }];
  });
}
