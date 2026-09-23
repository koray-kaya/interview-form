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

/** A follow-up the model asked and the participant has not answered yet. */
export type PendingFollowUp = { questionId: string; index: number; text: string };

export function pendingFollowUps(
  asked: { question_id: string; followup_index: number; followup_text: string }[],
  rows: AnswerRow[],
): PendingFollowUp[] {
  return asked
    .filter((ask) => !rows.some((row) => row.question_id === ask.question_id && row.followup_index === ask.followup_index))
    .map((ask) => ({ questionId: ask.question_id, index: ask.followup_index, text: ask.followup_text }));
}

/** First eight hex characters of the response id. */
export function referenceCode(id: string): string {
  return id.replaceAll("-", "").slice(0, 8);
}
