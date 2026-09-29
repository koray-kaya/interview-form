// The thread rules of the design note §5, on invented rows.
import { describe, expect, it } from "vitest";
import type { StoredAnswer, StoredCall } from "@/db";
import { buildThread } from "@/threads";

const T = (minute: number) => `2026-10-01T08:${String(minute).padStart(2, "0")}:00+00:00`;

function answer(followup_index: number, text: string, minute: number, question_text = "case"): StoredAnswer {
  return { id: `a${followup_index}-${minute}`, response_id: "r", question_id: "case", followup_index, question_text, value: { text }, created_at: T(minute) };
}

function call(followup_index: number, decision: StoredCall["decision"], minute: number, over: Partial<StoredCall> = {}): StoredCall {
  return {
    id: followup_index * 100 + minute, response_id: "r", question_id: "case", followup_index, decision, created_at: T(minute),
    model: "test/model", prompt_version: "3", followup_text: null, reason: null, error_class: null,
    input_tokens: 1, output_tokens: 1, latency_ms: 1, inference_region: "eu", ...over,
  };
}

const main = answer(0, "Wir suchten einen Lieferanten.", 1);

describe("buildThread", () => {
  it("shows an ask with its reason and reply, then the stop", () => {
    const thread = buildThread(
      main,
      [answer(1, "Im Handelsregister.", 3, "Welche Quellen?")],
      [call(1, "ask", 2, { followup_text: "Welche Quellen?", reason: "No source is named." }), call(2, "stop", 4, { reason: "Both elements present." })],
      2,
    );
    expect(thread.steps).toEqual([
      { index: 1, reply: { question: "Welche Quellen?", text: "Im Handelsregister." }, decisions: [{ decision: "ask", followUp: "Welche Quellen?", reason: "No source is named.", errorClass: null, stale: false }] },
      { index: 2, reply: null, decisions: [{ decision: "stop", followUp: null, reason: "Both elements present.", errorClass: null, stale: false }] },
    ]);
    expect(thread.end).toBe("decided");
  });

  it("ends at the limit after two answered follow-ups", () => {
    const thread = buildThread(
      main,
      [answer(1, "Eins.", 3, "F1?"), answer(2, "Zwei.", 5, "F2?")],
      [call(1, "ask", 2, { followup_text: "F1?", reason: "r1" }), call(2, "ask", 4, { followup_text: "F2?", reason: "r2" })],
      2,
    );
    expect(thread.end).toBe("limit");
    expect(thread.max).toBe(2);
  });

  it("says no call was made when there is none, never a stop", () => {
    expect(buildThread(main, [], [], 2)).toEqual({ steps: [], end: "no-call", max: 2 });
    const afterAsk = buildThread(main, [answer(1, "Eins.", 3, "F1?")], [call(1, "ask", 2, { followup_text: "F1?", reason: "r" })], 2);
    expect(afterAsk.end).toBe("no-call");
  });

  it("keeps the error class of a failed call and the reason of a rejected one", () => {
    const thread = buildThread(main, [], [call(1, "error", 2, { error_class: "timeout" }), call(2, "rejected", 3, { reason: "Asked for an e-mail address." })], 2);
    expect(thread.steps.map((s) => s.decisions[0])).toEqual([
      { decision: "error", followUp: null, reason: null, errorClass: "timeout", stale: true },
      { decision: "rejected", followUp: null, reason: "Asked for an e-mail address.", errorClass: null, stale: false },
    ]);
    expect(thread.end).toBe("decided");
  });

  it("allows follow-up 2 after a stop and marks the stop as made on an earlier answer", () => {
    const thread = buildThread(
      main,
      [answer(2, "Ein Beispiel.", 6, "Ein Beispiel?")],
      [call(1, "stop", 2, { reason: "Concrete enough." }), call(2, "ask", 4, { followup_text: "Ein Beispiel?", reason: "No occurrence." })],
      2,
    );
    expect(thread.steps.map((s) => [s.index, s.decisions[0].decision, s.decisions[0].stale])).toEqual([
      [1, "stop", true],
      [2, "ask", false],
    ]);
    expect(thread.steps[1].reply?.text).toBe("Ein Beispiel.");
    expect(thread.end).toBe("limit");
  });

  it("marks a call older than the main answer, and a call older than the reply before it", () => {
    const olderThanMain = buildThread(answer(0, "Neu.", 10), [], [call(1, "stop", 2, { reason: "old" })], 2);
    expect(olderThanMain.steps[0].decisions[0].stale).toBe(true);
    const beforeReply = buildThread(
      main,
      [answer(1, "Eins.", 5, "F1?")],
      [call(1, "ask", 2, { followup_text: "F1?", reason: "r" }), call(2, "stop", 3, { reason: "early" })],
      2,
    );
    expect(beforeReply.steps[1].decisions[0].stale).toBe(true);
  });

  it("shows both calls when two share an index", () => {
    const thread = buildThread(
      main,
      [answer(1, "Eins.", 4, "F1?")],
      [call(1, "ask", 2, { followup_text: "F1?", reason: "a" }), call(1, "ask", 3, { followup_text: "Other?", reason: "b" })],
      2,
    );
    expect(thread.steps[0].decisions.map((d) => d.followUp)).toEqual(["F1?", "Other?"]);
  });
});
