// Small helpers the route handlers share: rebuild the answer set from stored
// rows, tell whether every active question is answered, and derive the
// reference code the participant can quote to have their answers removed.
import type { AnswerRow } from "@/db";
import { AnswerValueSchema, nextQuestion, type Answers } from "@/engine";
import { FORM } from "@/form";

/** The fixed answers (follow-ups excluded) as the engine expects them. */
export function fixedAnswers(rows: AnswerRow[]): Answers {
  const answers: Answers = {};
  for (const row of rows) {
    if (row.followup_index !== 0) continue;
    const value = AnswerValueSchema.safeParse(row.value);
    if (value.success) answers[row.question_id] = value.data;
  }
  return answers;
}

export function isComplete(answers: Answers): boolean {
  return nextQuestion(FORM, answers) === null;
}

/** First eight hex characters of the response id. */
export function referenceCode(id: string): string {
  return id.replaceAll("-", "").slice(0, 8);
}
