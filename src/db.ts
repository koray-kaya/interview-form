// The only place that talks to Supabase. Uses supabase-js with the secret key
// (full access, server only) and offers one small function per operation the
// routes need. Routes never build queries themselves; their tests mock this
// module.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnswerValue } from "@/engine";
import type { Lang } from "@/i18n";
import { serverEnv } from "@/env";

export type ResponseRow = {
  id: string;
  company_uid: string | null;
  probe_allowed: boolean;
  lang: Lang;
  form_version: string;
  consented_at: string;
  completed_at: string | null;
  created_at: string;
};

export type AnswerRow = {
  question_id: string;
  followup_index: number;
  question_text: string;
  value: AnswerValue;
};

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const env = serverEnv();
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// supabase-js reports failures in `error` instead of throwing; this turns them
// into exceptions so a route cannot forget to check.
function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what} failed: ${result.error.message}`);
  return result.data;
}

// Like check, for queries that must return data (a row that was just written,
// a list that is at least empty).
function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = check(result, what);
  if (data === null || data === undefined) throw new Error(`${what} returned no data`);
  return data;
}

export async function createResponse(input: {
  companyUid: string | null;
  lang: Lang;
  formVersion: string;
  probeAllowed: boolean;
}): Promise<string> {
  const row = must(
    await db()
      .from("responses")
      .insert({
        company_uid: input.companyUid,
        lang: input.lang,
        form_version: input.formVersion,
        probe_allowed: input.probeAllowed,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
    "createResponse",
  );
  return row.id as string;
}

/** The response and its answers, or null when the id is unknown. */
export async function getResponse(id: string): Promise<{ response: ResponseRow; answers: AnswerRow[] } | null> {
  const response = check(
    await db().from("responses").select("*").eq("id", id).maybeSingle(),
    "getResponse",
  ) as ResponseRow | null;
  if (!response) return null;
  const answers = must(
    await db()
      .from("answers")
      .select("question_id, followup_index, question_text, value")
      .eq("response_id", id)
      .order("created_at"),
    "getResponse answers",
  ) as AnswerRow[];
  return { response, answers };
}

/**
 * Stores one answer and deletes the answers of the pruned questions, in one
 * transaction (the save_answer function in the migration). False when the
 * response is unknown or already completed.
 */
export async function saveAnswer(input: {
  responseId: string;
  questionId: string;
  followupIndex: number;
  questionText: string;
  value: AnswerValue;
  pruned: string[];
}): Promise<boolean> {
  const saved = check(
    await db().rpc("save_answer", {
      p_response_id: input.responseId,
      p_question_id: input.questionId,
      p_followup_index: input.followupIndex,
      p_question_text: input.questionText,
      p_value: input.value,
      p_pruned: input.pruned,
    }),
    "saveAnswer",
  );
  return saved === true;
}

/** Sets completed_at once; returns the timestamp that is stored. */
export async function completeResponse(id: string): Promise<string> {
  check(
    await db().from("responses").update({ completed_at: new Date().toISOString() }).eq("id", id).is("completed_at", null),
    "completeResponse",
  );
  const row = must(
    await db().from("responses").select("completed_at").eq("id", id).single(),
    "completeResponse read",
  );
  return row.completed_at as string;
}

/** Deletes responses never completed and created before the given time. */
export async function deleteUnfinishedBefore(before: Date): Promise<number> {
  const rows = must(
    await db().from("responses").delete().is("completed_at", null).lt("created_at", before.toISOString()).select("id"),
    "deleteUnfinishedBefore",
  );
  return rows.length;
}

/** One cheap read, so the project counts as active (Supabase Free pauses idle projects). */
export async function touch(): Promise<void> {
  check(await db().from("responses").select("id").limit(1), "touch");
}

/** Every row of the three tables, for the export. */
export async function readAll(): Promise<{ responses: unknown[]; answers: unknown[]; probe_calls: unknown[] }> {
  const [responses, answers, probeCalls] = await Promise.all([
    db().from("responses").select("*").order("created_at"),
    db().from("answers").select("*").order("created_at"),
    db().from("probe_calls").select("*").order("created_at"),
  ]);
  return {
    responses: must(responses, "readAll responses"),
    answers: must(answers, "readAll answers"),
    probe_calls: must(probeCalls, "readAll probe_calls"),
  };
}

export type ProbeDecision = "ask" | "stop" | "error" | "rejected";

export type ProbeCallRow = {
  response_id: string;
  question_id: string;
  followup_index: number;
  model: string;
  prompt_version: string;
  decision: ProbeDecision;
  followup_text: string | null;
  reason: string | null;
  error_class: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
};

/** Model calls already made for one question of one response (the limit counts these). */
export async function countProbeCalls(responseId: string, questionId: string): Promise<number> {
  const result = await db()
    .from("probe_calls")
    .select("id", { count: "exact", head: true })
    .eq("response_id", responseId)
    .eq("question_id", questionId);
  if (result.error) throw new Error(`countProbeCalls failed: ${result.error.message}`);
  return result.count ?? 0;
}

export async function logProbeCall(row: ProbeCallRow): Promise<void> {
  check(await db().from("probe_calls").insert(row), "logProbeCall");
}

/** Every follow-up question that was shown ("ask"), in order. */
export async function askedFollowUps(
  responseId: string,
): Promise<{ question_id: string; followup_index: number; followup_text: string }[]> {
  return must(
    await db()
      .from("probe_calls")
      .select("question_id, followup_index, followup_text")
      .eq("response_id", responseId)
      .eq("decision", "ask")
      .not("followup_text", "is", null)
      .order("created_at"),
    "askedFollowUps",
  ) as { question_id: string; followup_index: number; followup_text: string }[];
}
