import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import { toCsv, type CsvAnswer, type CsvResponse } from "@/csv";

// Every value here is invented: no participant text, no real company.
const DONE = "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f";
const ESCAPED = "7a7a7a7a-1111-4222-8333-444455556666";

const response = (id: string, overrides: Partial<CsvResponse> = {}): CsvResponse => ({
  id,
  company_uid: "CHE-123.456.788",
  lang: "de",
  form_version: "2.0.0",
  created_at: "2026-10-01T08:00:00.000Z",
  completed_at: "2026-10-01T08:12:30.000Z",
  ...overrides,
});

const answer = (response_id: string, question_id: string, value: CsvAnswer["value"], followup_index = 0, question_text = "…"): CsvAnswer => ({
  response_id, question_id, followup_index, question_text, value,
});

const NEVER = { "new-customers": "never", "new-suppliers": "never", "one-company": "never", competitors: "never", "own-position": "never" };

const ANSWERS: CsvAnswer[] = [
  answer(DONE, "role", { option: "owner" }),
  answer(DONE, "case", { text: "Wir suchten einen Lieferanten, \"schnell\", über den Verband.\nDann Website." }),
  answer(DONE, "case", { text: "Beim Verband." }, 1, "Wo haben Sie nachgeschaut?"),
  answer(DONE, "cost", { options: ["paid-report", "outside-help"] }),
  answer(DONE, "activities", { rows: { ...NEVER, competitors: "monthly" } }),
  answer(DONE, "sources", { options: ["website"] }),
  answer(DONE, "followup", { options: ["conversation"], email: "person@example.ch" }),
  answer(ESCAPED, "case", { option: "none" }),
  answer(ESCAPED, "activities", { rows: NEVER }),
];

/** The CSV as an array of objects keyed by header, for readable assertions. */
function parse(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = csv.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i]])));
}

describe("toCsv", () => {
  const csv = toCsv(FORM, [
    response(DONE),
    response(ESCAPED, { lang: "en" }),
    response("00000000-0000-4000-8000-000000000001", { completed_at: null }),
    response("00000000-0000-4000-8000-000000000002", { form_version: "1.0.0" }),
  ], ANSWERS);
  const [done, escaped] = parse(csv);

  it("has one row per completed response of this form version", () => {
    expect(parse(csv)).toHaveLength(2);
    expect(done.reference).toBe("3f1c2b7a");
    expect(escaped.reference).toBe("7a7a7a7a");
  });

  it("starts with a byte-order mark and uses CRLF, so spreadsheet programs read umlauts and rows", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("names the columns in form order: one per single choice, one per option, row and follow-up", () => {
    const header = Object.keys(done);
    expect(header.slice(0, 6)).toEqual(["reference", "company_uid", "lang", "started_at", "completed_at", "minutes"]);
    expect(header).toContain("cost.paid-report");
    expect(header).toContain("activities.own-position");
    expect(header).toContain("case.escaped");
    expect(header).toContain("case.followup2.answer");
    expect(header.indexOf("role")).toBeLessThan(header.indexOf("case"));
    expect(header.indexOf("activities.new-customers")).toBeLessThan(header.indexOf("who"));
  });

  it("writes ids for choices, 1 or 0 per option, and scale ids per row", () => {
    expect(done.role).toBe("owner");
    expect(done["cost.paid-report"]).toBe("1");
    expect(done["cost.outside-help"]).toBe("1");
    expect(done["cost.no"]).toBe("0");
    expect(done["activities.competitors"]).toBe("monthly");
    expect(done["activities.new-customers"]).toBe("never");
  });

  it("keeps written text whole, and the follow-ups with the question they answered", () => {
    expect(done.case).toBe("Wir suchten einen Lieferanten, \"schnell\", über den Verband.\nDann Website.");
    expect(done["case.escaped"]).toBe("0");
    expect(done["case.followup1.question"]).toBe("Wo haben Sie nachgeschaut?");
    expect(done["case.followup1.answer"]).toBe("Beim Verband.");
    expect(done["case.followup2.answer"]).toBe("");
  });

  it("marks the escape, and leaves the questions it skipped empty rather than 0", () => {
    expect(escaped.case).toBe("");
    expect(escaped["case.escaped"]).toBe("1");
    expect(escaped.duration).toBe("");
    expect(escaped["cost.no"]).toBe("");
    expect(escaped["sources.website"]).toBe("");
  });

  it("counts the minutes from start to finish", () => {
    expect(done.minutes).toBe("12.5");
  });

  it("never carries the e-mail address", () => {
    expect(csv).not.toContain("person@example.ch");
    expect(Object.keys(done).some((name) => name.includes("email"))).toBe(false);
  });
});
