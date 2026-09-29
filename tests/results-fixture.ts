// Invented rows for the results tests: fictional companies, codes and
// addresses only (the repository is public). Two completed responses count
// (codes aaaa0001 and aaaa0002); the unfinished one, the one on an older form
// and the smoke test's do not.
import type { ResponseRow, StoredAnswer, StoredCall } from "@/db";
import type { AnswerValue } from "@/engine";

export const UID = "CHE-123.456.788";
export const PERSONAL = "P-7K3Q9X";
export const EMAIL = "anna.muster@muster-metallbau.ch";

const id = (n: number) => `aaaa000${n}-0000-4000-8000-00000000000${n}`;
export const R1 = id(1);
export const R2 = id(2);

function response(n: number, over: Partial<ResponseRow>): ResponseRow {
  return {
    id: id(n), company_uid: null, probe_allowed: true, lang: "de", form_version: "2.0.0",
    consented_at: "2026-10-01T08:00:00+00:00", created_at: "2026-10-01T08:00:00+00:00", completed_at: null, ...over,
  };
}

export const responses: ResponseRow[] = [
  response(2, { company_uid: PERSONAL, created_at: "2026-10-02T09:00:00+00:00", completed_at: "2026-10-02T09:20:00+00:00" }),
  response(1, { company_uid: UID, created_at: "2026-10-01T08:00:00+00:00", completed_at: "2026-10-01T08:12:00+00:00" }),
  response(3, { created_at: "2026-10-03T10:00:00+00:00" }),
  response(4, { form_version: "1.0.0", completed_at: "2026-10-01T08:30:00+00:00" }),
  response(5, { company_uid: "SMOKE", completed_at: "2026-10-01T08:05:00+00:00" }),
];

let serial = 0;
function a(n: number, question_id: string, value: AnswerValue, time: string, followup_index = 0, question_text = question_id): StoredAnswer {
  serial += 1;
  return { id: `b-${serial}`, response_id: id(n), question_id, followup_index, question_text, value, created_at: `2026-10-0${n === 2 ? 2 : 1}T${time}:00+00:00` };
}

export const answers: StoredAnswer[] = [
  a(1, "role", { option: "owner" }, "08:01"),
  a(1, "size", { option: "10-49" }, "08:01"),
  a(1, "customers", { option: "businesses" }, "08:01"),
  a(1, "case", { text: "Wir suchten einen zweiten Lieferanten für Kartonschachteln." }, "08:02"),
  a(1, "case", { text: "Im Handelsregister und auf der Website der Beispiel Verpackung AG." }, "08:04", 1, "Welche Quellen haben Sie dafür genutzt?"),
  a(1, "duration", { option: "lt2h" }, "08:05"),
  a(1, "cost", { options: ["paid-report", "retired-option"] }, "08:05"),
  a(1, "result", { option: "partly" }, "08:05"),
  a(1, "pains", { text: "Ob eine Firma zuverlässig liefert, steht nirgends." }, "08:06"),
  a(1, "gains", { text: "Eine Liste mit drei geprüften Lieferanten." }, "08:07"),
  a(1, "gains", { text: "Wir hätten schneller bestellt." }, "08:08", 1, "Was hätte sich dadurch für Sie verändert?"),
  a(1, "gains", { text: "Etwa einen Tag." }, "08:09", 2, "Wie viel Zeit hätten Sie gespart?"),
  a(1, "activities", { rows: { "new-customers": "monthly", "new-suppliers": "1-2", "one-company": "3-6", competitors: "never", "own-position": "never" } }, "08:10"),
  a(1, "who", { option: "me" }, "08:10"),
  a(1, "skipped", { options: ["no-time"] }, "08:10"),
  a(1, "sources", { options: ["website", "register"] }, "08:11"),
  a(1, "followup", { options: ["conversation"], email: EMAIL }, "08:11"),

  a(2, "role", { option: "purchasing" }, "09:01"),
  a(2, "size", { option: "1-9" }, "09:01"),
  a(2, "customers", { option: "both" }, "09:01"),
  a(2, "case", { option: "none" }, "09:02"),
  a(2, "pains", { text: "Ich finde selten, was ich suche; <b>nirgends</b> steht es." }, "09:04"),
  a(2, "pains", { text: "Bei einer Gärtnerei im Thurgau fand ich keine Angaben." }, "09:08", 2, "Können Sie ein Beispiel nennen?"),
  a(2, "activities", { rows: { "new-customers": "never", "new-suppliers": "never", "one-company": "never", competitors: "never", "own-position": "never" } }, "09:10"),
  a(2, "who", { option: "no-one" }, "09:10"),
  a(2, "skipped", { options: ["none"] }, "09:11"),
  a(2, "followup", { options: ["neither"] }, "09:12"),

  a(3, "role", { option: "owner" }, "10:01"),
  a(4, "role", { option: "sales" }, "08:20"),
  a(5, "role", { option: "sales" }, "08:03"),
];

function c(n: number, question_id: string, followup_index: number, decision: StoredCall["decision"], time: string, over: Partial<StoredCall> = {}): StoredCall {
  serial += 1;
  return {
    id: serial, response_id: id(n), question_id, followup_index, decision, created_at: `2026-10-0${n === 2 ? 2 : 1}T${time}:00+00:00`,
    model: "test/model", prompt_version: "3", followup_text: null, reason: null, error_class: null,
    input_tokens: 100, output_tokens: 20, latency_ms: 900, inference_region: "eu", ...over,
  };
}

export const calls: StoredCall[] = [
  c(1, "case", 1, "ask", "08:03", { reason: "The need is named but no step or source.", followup_text: "Welche Quellen haben Sie dafür genutzt?" }),
  c(1, "case", 2, "stop", "08:04", { reason: "Steps and sources are now present." }),
  c(1, "pains", 1, "stop", "08:06", { reason: "The answer gives a concrete example." }),
  c(1, "gains", 1, "ask", "08:07", { reason: "No change for the firm is named.", followup_text: "Was hätte sich dadurch für Sie verändert?" }),
  c(1, "gains", 2, "ask", "08:08", { reason: "The change is not quantified.", followup_text: "Wie viel Zeit hätten Sie gespart?" }),
  c(2, "pains", 1, "stop", "09:05", { reason: "The answer names a difficulty." }),
  c(2, "pains", 2, "ask", "09:07", { reason: "No particular occurrence is described.", followup_text: "Können Sie ein Beispiel nennen?" }),
  c(3, "case", 1, "error", "10:01", { error_class: "timeout" }),
];

export const rows = { responses, answers, probe_calls: calls };
