// POST /api/responses/:id/answers — stores one answer. The server applies the
// same rule as the browser (applyAnswer in the engine): the value is cleaned,
// checked, and whatever it makes obsolete is deleted in the same transaction.
// The question text stored with the answer comes from the form, never from
// the request. Follow-ups (followupIndex 1–2) arrive in M3.
import { z } from "zod";
import { askedFollowUps, countProbeCalls, deleteFollowUps, getResponse, logProbeCall, saveAnswer, setLang, type AnswerRow, type ResponseRow } from "@/db";
import { AnswerValueSchema, applyAnswer, isEscape, isSkipped, sameAnswer, validate, type AnswerValue } from "@/engine";
import { FORM, type OpenQuestion, type Question } from "@/form";
import { probeEnabled } from "@/env";
import { t, type Lang } from "@/i18n";
import { isUuid, json, readJson } from "@/http";
import { runProbe, type Turn } from "@/probe";
import { fixedAnswers } from "@/responses";
import { UI } from "@/texts";

const Body = z.object({
  questionId: z.string().max(64),
  /** 0 is the question itself; 1 and 2 are the answers to the model's follow-ups. */
  followupIndex: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  value: AnswerValueSchema,
  /** The language on screen when the answer was given; absent means unchanged. */
  lang: z.enum(["de", "en"]).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const parsed = await readJson(request, Body);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  if (!isUuid(id)) return json(404, { error: "not found" });

  const { questionId, value } = parsed.data;
  const question = FORM.questions.find((q) => q.id === questionId);
  if (!question) return json(400, { error: "unknown question" });

  const found = await getResponse(id);
  if (!found) return json(404, { error: "not found" });
  if (found.response.completed_at !== null) return json(409, { error: "response already completed" });

  // The participant may have switched language since the response was created.
  // The request decides what they saw; the text itself still comes from the form.
  const lang = parsed.data.lang ?? found.response.lang;
  // recorded only once the answer is accepted: a refused request changes nothing
  const keepLang = async () => {
    if (lang !== found.response.lang) await setLang(id, lang);
  };

  if (parsed.data.followupIndex > 0) {
    return await storeFollowUp({ id, question, index: parsed.data.followupIndex, value, lang, found, keepLang });
  }

  const before = fixedAnswers(found.answers);
  if (isSkipped(FORM, questionId, before)) return json(400, { error: "question not active" });

  const problem = validate(question, value, lang);
  if (problem) return json(400, { error: problem });
  await keepLang();

  const after = applyAnswer(FORM, before, questionId, value);
  const cleaned = after[questionId];
  const pruned = Object.keys(before).filter((key) => key !== questionId && !(key in after));

  const previous = before[questionId];
  if (previous && sameAnswer(previous, cleaned) && pruned.length === 0) return json(200, { followUp: null });

  const saved = await saveAnswer({
    responseId: id,
    questionId,
    followupIndex: 0,
    questionText: t(question.text, lang),
    value: cleaned,
    pruned,
  });
  if (!saved) return json(409, { error: "response already completed" });

  // "I can't think of such a case" is an answer, not something to judge. It
  // withdraws the case, so the answers to the model's questions about it go too;
  // the probe_calls rows stay as the record of what was asked.
  if (isEscape(question, cleaned)) {
    if (found.answers.some((row) => row.question_id === questionId && row.followup_index > 0)) {
      await deleteFollowUps(id, questionId);
    }
    return json(200, { followUp: null });
  }

  const rows = withRow(found.answers, {
    question_id: questionId,
    followup_index: 0,
    question_text: t(question.text, lang),
    value: cleaned,
  });
  const followUp = await probeAnswer({ id, question, lang, rows, allowed: found.response.probe_allowed });
  return json(200, { followUp });
}

/**
 * The answer to one of the model's follow-ups. The question text is read from
 * the probe_calls row that asked it, never from the request: the server
 * decides what the participant saw. Answering it may earn a second follow-up,
 * if the question has a model call left.
 */
async function storeFollowUp(input: {
  id: string;
  question: Question;
  index: number;
  value: AnswerValue;
  lang: Lang;
  found: { response: ResponseRow; answers: AnswerRow[] };
  keepLang: () => Promise<void>;
}): Promise<Response> {
  const { id, question, index, value, lang, found, keepLang } = input;
  if (!isProbed(question)) return json(400, { error: "question not active" });
  // the follow-up belongs to a written answer that still counts (see pendingFollowUps)
  const fixed = fixedAnswers(found.answers);
  const own = fixed[question.id];
  if (!own || !("text" in own) || isSkipped(FORM, question.id, fixed)) return json(400, { error: "question not active" });

  const asked = await askedFollowUps(id);
  const match = asked.find((row) => row.question_id === question.id && row.followup_index === index);
  if (!match) return json(400, { error: "follow-up not asked" });
  if (found.answers.some((row) => row.question_id === question.id && row.followup_index === index)) {
    return json(400, { error: "follow-up already answered" });
  }

  // a follow-up is always answered in words; the escape belongs to the question itself
  const problem = "text" in value ? validate(question, value, lang) : t(UI.required, lang);
  if (problem) return json(400, { error: problem });
  await keepLang();

  const saved = await saveAnswer({
    responseId: id,
    questionId: question.id,
    followupIndex: index,
    questionText: match.followup_text,
    value,
    pruned: [],
  });
  if (!saved) return json(409, { error: "response already completed" });

  const rows = withRow(found.answers, {
    question_id: question.id,
    followup_index: index,
    question_text: match.followup_text,
    value,
  });
  const followUp = await probeAnswer({ id, question, lang, rows, allowed: found.response.probe_allowed });
  return json(200, { followUp });
}

/** The stored rows with one of them replaced by the row just written. */
function withRow(rows: AnswerRow[], written: AnswerRow): AnswerRow[] {
  const others = rows.filter(
    (row) => !(row.question_id === written.question_id && row.followup_index === written.followup_index),
  );
  return [...others, written];
}

const answerText = (value: AnswerValue | undefined): string => (value && "text" in value ? value.text : "");

/**
 * One question's whole exchange: the question and its answer, then each
 * follow-up. Empty when the question was escaped: there is nothing to judge
 * and nothing to give another question as context.
 */
function transcript(questionId: string, rows: AnswerRow[]): Turn[] {
  const own = rows
    .filter((row) => row.question_id === questionId)
    .sort((a, b) => a.followup_index - b.followup_index);
  const first = own[0];
  if (!first || first.followup_index !== 0 || !("text" in first.value)) return [];
  return own.map((row) => ({ question: row.question_text, answer: answerText(row.value) }));
}

const isProbed = (question: Question): question is OpenQuestion & { probe: NonNullable<OpenQuestion["probe"]> } =>
  question.type === "open" && question.probe !== undefined;

/**
 * One model call after a changed answer, when the invitation carried a valid
 * company number, the kill switch is on and the question has calls left. Every
 * outcome is logged; only "ask" reaches the participant.
 */
async function probeAnswer(input: {
  id: string;
  question: Question;
  lang: Lang;
  rows: AnswerRow[];
  allowed: boolean;
}): Promise<{ index: number; text: string } | null> {
  const { id, question, lang, rows } = input;
  if (!isProbed(question) || !input.allowed || !probeEnabled()) return null;

  const made = await countProbeCalls(id, question.id);
  if (made >= question.probe.maxFollowUps) return null;
  const index = made + 1;

  const result = await runProbe({
    question,
    lang,
    transcript: transcript(question.id, rows),
    context: (question.probe.context ?? []).flatMap((earlier) => transcript(earlier, rows)),
  });

  await logProbeCall({
    response_id: id,
    question_id: question.id,
    followup_index: index,
    model: result.model,
    prompt_version: result.promptVersion,
    decision: result.decision,
    followup_text: result.decision === "ask" ? (result.followUp ?? null) : null,
    reason: result.reason ?? null,
    error_class: result.errorClass ?? null,
    input_tokens: result.inputTokens ?? null,
    output_tokens: result.outputTokens ?? null,
    latency_ms: result.latencyMs,
  });

  return result.decision === "ask" && result.followUp ? { index, text: result.followUp } : null;
}
