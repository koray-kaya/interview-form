// The only place that talks to Supabase. Uses supabase-js with the secret key
// (full access, server only) and offers one small function per operation the
// routes need. Routes never build queries themselves; their tests mock this
// module.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnswerValue } from "@/engine";
import type { Lang } from "@/i18n";
import { serverEnv } from "@/env";
import { SMOKE_TAG } from "@/responses";
import type { TagSource } from "@/tags";
import type { StatsCall, StatsResponse } from "@/stats";

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

/** An answers row as stored: the export and the results pages read these. */
export type StoredAnswer = AnswerRow & { id: string; response_id: string; created_at: string };

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

/**
 * Hosted Supabase (PostgREST) returns at most 1000 rows without an error, so
 * an unpaged select can silently come back short. Compare the rows against
 * the query's exact count (`{ count: "exact" }`) and fail loudly rather than
 * let a caller mistake a cut-off page for the whole list. `readEvery` pages;
 * `readTagSources` still reads one page and relies on this check. A null
 * count (the option was left off, or PostgREST did not send one) throws too
 * — without a count we cannot tell a short page from a complete one.
 */
export function wholeList<T>(rows: T[], count: number | null, what: string): T[] {
  if (count === null) throw new Error(`${what}: no row count; page the query`);
  if (rows.length < count) throw new Error(`${what}: got ${rows.length} of ${count} rows; page the query`);
  return rows;
}

const PAGE = 1000;

/**
 * Every row of a table, read in pages of PAGE (PostgREST's cap) in a stable
 * order — created_at, then id — and checked against the exact count by
 * wholeList, so a cut-off read throws instead of passing for the whole
 * table (#25). Offset paging is not a snapshot: a row deleted between two
 * pages can shift the next page by one, so past 1000 rows a read during
 * writes can miss a row; keyset paging would fix it.
 */
async function readEvery<T>(table: string, columns: string, what: string): Promise<T[]> {
  const rows: T[] = [];
  let count: number | null = null;
  for (let from = 0; ; from += PAGE) {
    const result = await db()
      .from(table)
      .select(columns, { count: "exact" })
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    const page = must(result, what) as unknown as T[];
    count = result.count;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return wholeList(rows, count, what);
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
/**
 * The language of a response is the one last used: a participant may switch
 * while answering, and each answer keeps the wording that was on screen.
 */
export async function setLang(id: string, lang: Lang): Promise<void> {
  check(await db().from("responses").update({ lang }).eq("id", id), "setLang");
}

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

/**
 * Deletes the answers to the model's follow-ups on one question (followup
 * index 1–2). Used when the question's own answer is withdrawn by its escape.
 */
export async function deleteFollowUps(responseId: string, questionId: string): Promise<void> {
  check(
    await db().from("answers").delete().eq("response_id", responseId).eq("question_id", questionId).gt("followup_index", 0),
    "deleteFollowUps",
  );
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

/** Deletes the production smoke test's responses (company tag SMOKE_TAG). */
export async function deleteSmokeResponses(): Promise<number> {
  const rows = must(
    await db().from("responses").delete().eq("company_uid", SMOKE_TAG).select("id"),
    "deleteSmokeResponses",
  );
  return rows.length;
}

/** One cheap read, so the project counts as active (Supabase Free pauses idle projects). */
export async function touch(): Promise<void> {
  check(await db().from("responses").select("id").limit(1), "touch");
}

/** The few columns the admin page counts; no answer text. */
export async function readStats(): Promise<{ responses: StatsResponse[]; calls: StatsCall[] }> {
  const [responses, calls] = await Promise.all([
    readEvery<StatsResponse>("responses", "company_uid, lang, form_version, created_at, completed_at", "readStats responses"),
    readEvery<StatsCall>("probe_calls", "decision", "readStats probe_calls"),
  ]);
  return { responses, calls };
}

/**
 * The three columns toTags needs, for company-reach; no answers. Ordered
 * oldest first, so a silent 1000-row cut-off would drop the newest tags;
 * `wholeList` turns that into a thrown error instead.
 */
export async function readTagSources(): Promise<TagSource[]> {
  const result = await db()
    .from("responses")
    .select("company_uid, created_at, completed_at", { count: "exact" })
    .order("created_at");
  const rows = must(result, "readTagSources") as TagSource[];
  return wholeList(rows, result.count, "readTagSources");
}

/** Every row of the three tables, for the export and the results pages. */
export async function readAll(): Promise<{ responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] }> {
  const [responses, answers, probeCalls] = await Promise.all([
    readEvery<ResponseRow>("responses", "*", "readAll responses"),
    readEvery<StoredAnswer>("answers", "*", "readAll answers"),
    readEvery<StoredCall>("probe_calls", "*", "readAll probe_calls"),
  ]);
  return { responses, answers, probe_calls: probeCalls };
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
  /** Where inference ran ("eu"), as the gateway reported it; null when it did not say. */
  inference_region: string | null;
};

/** A probe_calls row as stored. */
export type StoredCall = ProbeCallRow & { id: number; created_at: string };

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
