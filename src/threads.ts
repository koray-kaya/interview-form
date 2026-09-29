// The follow-up thread of one open answer, rebuilt from the answers and
// probe_calls rows (design note §5): for each follow-up index, the model's
// decisions in order and the participant's reply. A call's index is the
// number of calls made before it plus one, whatever their decision, and
// calls are never deleted, so a decision can belong to an earlier version of
// the answer; those are marked stale. Pure function, tested without a
// database.
import type { ProbeDecision, StoredAnswer, StoredCall } from "@/db";

export type Decision = {
  decision: ProbeDecision;
  followUp: string | null;
  reason: string | null;
  errorClass: string | null;
  /** Made on an earlier version of the answer. */
  stale: boolean;
};

export type Step = { index: number; decisions: Decision[]; reply: { question: string; text: string } | null };

/** `end`: the limit was reached, the model decided (stop, rejected, error), or no further call was made. */
export type Thread = { steps: Step[]; end: "limit" | "decided" | "no-call"; max: number };

const time = (iso: string) => Date.parse(iso);

function isStale(call: StoredCall, main: StoredAnswer, calls: StoredCall[], replies: StoredAnswer[]): boolean {
  if (time(call.created_at) < time(main.created_at)) return true;
  if (call.decision !== "ask" && calls.some((other) => other.followup_index > call.followup_index)) return true;
  const replyBefore = replies.find((r) => r.followup_index === call.followup_index - 1);
  return replyBefore !== undefined && time(replyBefore.created_at) > time(call.created_at);
}

export function buildThread(main: StoredAnswer, replies: StoredAnswer[], calls: StoredCall[], max: number): Thread {
  const steps: Step[] = [];
  for (let index = 1; index <= max; index++) {
    const own = calls.filter((c) => c.followup_index === index).sort((a, b) => time(a.created_at) - time(b.created_at));
    const row = replies.find((r) => r.followup_index === index);
    const reply = row && "text" in row.value ? { question: row.question_text, text: row.value.text } : null;
    if (own.length === 0 && reply === null) continue;
    steps.push({
      index,
      reply,
      decisions: own.map((c) => ({
        decision: c.decision,
        followUp: c.followup_text,
        reason: c.reason,
        errorClass: c.error_class,
        stale: isStale(c, main, calls, replies),
      })),
    });
  }
  const last = steps.at(-1);
  const lastDecision = last?.decisions.at(-1);
  const end: Thread["end"] = !last
    ? "no-call"
    : lastDecision && lastDecision.decision !== "ask"
      ? "decided"
      : last.index >= max
        ? "limit"
        : "no-call";
  return { steps, end, max };
}
