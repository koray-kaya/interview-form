# Results Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Issue #31 (part of #5, M5). Fixes #25. Branch `feat/31-results-pages`, cut from `main`.

**Goal:** The researcher reads the survey results in the browser under `/admin/results` — per question, each open answer with its AI follow-ups, each response, and a contacts list — and can print them for the supervisors.

**Architecture:** `src/db.ts` reads every row of the three tables in pages (fixes #25). Three pure modules turn the rows into what the pages show: `src/results.ts` (counts, tiles, open answers, one response), `src/threads.ts` (the follow-up thread of one open answer) and `src/contacts.ts` (the only output with a company number or e-mail address). Four async Server Components under `src/app/admin/results/` read the rows, call the pure functions and render synchronous components from `src/components/results/`. Everything sits behind the existing admin password (`src/proxy.ts`).

**Tech Stack:** Next.js 16 App Router (Server Components), React 19, Tailwind 4 with the tokens in `src/app/globals.css`, supabase-js (through `src/db.ts` only), Vitest + Testing Library.

**Spec:** `docs/design/2026-09-28-results-dashboard.md` (read it first; §4 counting rules, §5 thread rules).

## Global Constraints

- The repository is public: fictional companies, codes, UIDs and e-mail addresses only, in tests and docs. Never read `data/`.
- Company number (`company_uid`) and e-mail address never appear on the Overview, Open answers or response pages; only `src/contacts.ts` returns them, and only the Contacts page shows them.
- Counted responses: `completed_at !== null`, `form_version === FORM_VERSION`, `company_uid !== "SMOKE"` (`SMOKE_TAG`).
- Count before share: `"3 / 5 · 60%"`; with n = 0 the label is `"0 / 0"`.
- Question numbers are the position in `FORM.questions` (1–14), not the participant's own numbering.
- `?l=de` shows German question and option texts; anything else (missing, `en`, an array) is English. Links between results pages keep `?l=de`.
- No new dependency. No client components.
- Every page calls `await connection()` (from `next/server`) first. `params` and `searchParams` are Promises (Next.js 16). 404 with `notFound()` from `next/navigation`.
- `src/db.ts` is the only module that talks to Supabase; page tests mock `@/db`.
- Test first. `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` must pass before the PR.
- Commits: conventional, English, subject ≤ 60 characters, ending with the `Co-Authored-By` line the session uses.

## Review Focus

1. **A reference code in the URL that is not eight lowercase hex characters** (`AAAA0002`, `aaaa0002x`, `../x`). Expected: 404, and the database is not read. Pinned in Task 6.
2. **No completed response yet** (the first days, or right after a form version change). Expected: every page renders, n = 0, labels `"0 / 0"`, no `NaN`, and the Responses tab is left out. Pinned in Task 3 and Task 5.
3. **Answer text containing markup** (`<b>nirgends</b>`). Expected: shown as the literal characters, never interpreted. Pinned in Task 6 (fixture text).
4. **An option id in the database that the form no longer has** (a form edited without a version bump). Expected: it is not counted and does not crash the page. Pinned in Task 3.
5. **`?l=` given twice** (`?l=de&l=de` arrives as an array). Expected: English, no crash. Pinned in Task 3.

---

### Task 1: Read every row, in pages (#25)

**Files:**
- Modify: `src/db.ts` (new types after `AnswerRow`; a paging helper after `wholeList`; `readStats` and `readAll` rewritten)
- Test: `tests/db-paging.test.ts`

**Interfaces:**
- Produces: `type StoredAnswer = AnswerRow & { id: string; response_id: string; created_at: string }`, `type StoredCall = ProbeCallRow & { id: number; created_at: string }`, `readAll(): Promise<{ responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] }>`. `readStats()` keeps its signature.

- [ ] **Step 1: Write the failing test**

`tests/db-paging.test.ts`:

```ts
// @vitest-environment node
// Supabase returns at most 1000 rows per request, without an error, so one
// select can come back cut off (#25). readAll and readStats page through
// every row and throw rather than return a short list. The client is faked:
// each table has a size, and a range returns the rows inside it.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ sizes: {} as Record<string, number>, short: "", ranges: [] as string[] }));

vi.mock("@/env", () => ({
  serverEnv: () => ({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          fake.ranges.push(`${table} ${from}-${to}`);
          const total = fake.sizes[table] ?? 0;
          const last = Math.min(to, total - 1);
          let data = Array.from({ length: Math.max(0, last - from + 1) }, (_, i) => ({ id: from + i }));
          if (table === fake.short) data = data.slice(1);
          return { data, error: null, count: total };
        },
      };
      return query;
    },
  }),
}));
import { readAll, readStats } from "@/db";

beforeEach(() => {
  fake.sizes = {};
  fake.short = "";
  fake.ranges = [];
});

describe("readAll", () => {
  it("reads every row past the 1000-row cap, page by page", async () => {
    fake.sizes = { responses: 3, answers: 2500, probe_calls: 1000 };
    const all = await readAll();
    expect(all.responses).toHaveLength(3);
    expect(all.answers).toHaveLength(2500);
    expect(all.answers.at(-1)).toEqual({ id: 2499 });
    expect(all.probe_calls).toHaveLength(1000);
    expect(fake.ranges.filter((r) => r.startsWith("answers"))).toEqual([
      "answers 0-999",
      "answers 1000-1999",
      "answers 2000-2999",
    ]);
  });

  it("throws instead of returning a cut-off list", async () => {
    fake.sizes = { responses: 1, answers: 1500, probe_calls: 0 };
    fake.short = "answers";
    await expect(readAll()).rejects.toThrow("readAll answers: got 999 of 1500 rows");
  });
});

describe("readStats", () => {
  it("pages too, so the admin counts are whole", async () => {
    fake.sizes = { responses: 1200, probe_calls: 5 };
    const stats = await readStats();
    expect(stats.responses).toHaveLength(1200);
    expect(stats.calls).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/db-paging.test.ts`
Expected: FAIL — the current `readAll` never calls `.range`; it awaits the fake query object itself, which is not a result, so it throws "returned no data" or the lengths do not match.

- [ ] **Step 3: Write the code**

In `src/db.ts`, after the `AnswerRow` type:

```ts
/** An answers row as stored: the export and the results pages read these. */
export type StoredAnswer = AnswerRow & { id: string; response_id: string; created_at: string };

/** A probe_calls row as stored. */
export type StoredCall = ProbeCallRow & { id: number; created_at: string };
```

After `wholeList`:

```ts
const PAGE = 1000;

/**
 * Every row of a table, read in pages of PAGE (PostgREST's cap) in a stable
 * order — created_at, then id — and checked against the exact count by
 * wholeList, so a cut-off read throws instead of passing for the whole
 * table (#25).
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
```

Replace `readStats`:

```ts
/** The few columns the admin page counts; no answer text. */
export async function readStats(): Promise<{ responses: StatsResponse[]; calls: StatsCall[] }> {
  const [responses, calls] = await Promise.all([
    readEvery<StatsResponse>("responses", "company_uid, lang, form_version, created_at, completed_at", "readStats responses"),
    readEvery<StatsCall>("probe_calls", "decision", "readStats probe_calls"),
  ]);
  return { responses, calls };
}
```

Replace `readAll`:

```ts
/** Every row of the three tables, for the export and the results pages. */
export async function readAll(): Promise<{ responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] }> {
  const [responses, answers, probeCalls] = await Promise.all([
    readEvery<ResponseRow>("responses", "*", "readAll responses"),
    readEvery<StoredAnswer>("answers", "*", "readAll answers"),
    readEvery<StoredCall>("probe_calls", "*", "readAll probe_calls"),
  ]);
  return { responses, answers, probe_calls: probeCalls };
}
```

Change the doc comment above `wholeList` from "paging is a later issue" to "`readEvery` pages; `readTagSources` still reads one page and relies on this check".

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/db-paging.test.ts tests/db.test.ts tests/export.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors (`buildExport` still returns `unknown[]` fields; typed arrays are assignable).

- [ ] **Step 5: Commit**

```bash
git add src/db.ts tests/db-paging.test.ts
git commit -m "fix: read every row in pages of 1000 (#25)"
```

---

### Task 2: The follow-up thread

**Files:**
- Create: `src/threads.ts`
- Test: `tests/threads.test.ts`

**Interfaces:**
- Consumes: `StoredAnswer`, `StoredCall`, `ProbeDecision` from `@/db` (Task 1).
- Produces:
  ```ts
  type Decision = { decision: ProbeDecision; followUp: string | null; reason: string | null; errorClass: string | null; stale: boolean };
  type Step = { index: number; decisions: Decision[]; reply: { question: string; text: string } | null };
  type Thread = { steps: Step[]; end: "limit" | "decided" | "no-call"; max: number };
  buildThread(main: StoredAnswer, replies: StoredAnswer[], calls: StoredCall[], max: number): Thread
  ```
  `main` is the written main answer (`followup_index` 0, `{ text }`); `replies` and `calls` belong to the same response and question.

- [ ] **Step 1: Write the failing test**

`tests/threads.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/threads.test.ts`
Expected: FAIL, cannot resolve `@/threads`.

- [ ] **Step 3: Write the code**

`src/threads.ts`:

```ts
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
```

Note on the error test: the error call at minute 2 is followed by a call at index 2, so rule 2 of `isStale` marks it stale — that is intended (a later call means the answer changed after it).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/threads.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/threads.ts tests/threads.test.ts
git commit -m "feat: rebuild an open answer's follow-up thread (#31)"
```

---

### Task 3: Counting — results.ts

**Files:**
- Modify: `src/engine.ts:34` (`function holds` → `export function holds`)
- Modify: `src/stats.ts:31` (`function median` → `export function median`)
- Create: `src/results.ts`
- Create: `tests/results-fixture.ts` (shared invented rows; not a test file itself)
- Test: `tests/results.test.ts`

**Interfaces:**
- Consumes: `readAll`'s row types (Task 1), `buildThread`, `Thread` (Task 2), `fixedAnswers`, `referenceCode`, `SMOKE_TAG` (`src/responses.ts`), `holds` (`src/engine.ts`), `median` (`src/stats.ts`).
- Produces (all exported from `src/results.ts`):
  ```ts
  type Rows = { responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] };
  resultsLang(value: string | string[] | undefined): Lang
  withLang(path: string, lang: Lang): string
  percent(count: number, n: number): number
  shareLabel(count: number, n: number): string
  countedResponses(form: Form, responses: ResponseRow[]): ResponseRow[]
  firstCode(form: Form, rows: Rows): string | null
  optionOf(question: Question, id: string): Option | undefined
  type OptionCount = { option: Option; count: number };
  type QuestionResult =
    | { type: "single" | "multi"; number: number; question: SingleQuestion | MultiQuestion; n: number; counts: OptionCount[] }
    | { type: "rows"; number: number; question: RowsQuestion; n: number; rows: { row: Option; counts: OptionCount[] }[] }
    | { type: "open"; number: number; question: OpenQuestion; n: number; written: number; escaped: number; followedUp: number; followUps: number };
  questionResults(form: Form, rows: Rows): QuestionResult[]
  type Tiles = { completed: number; medianMinutes: number | null; followUps: number; calls: number; stops: number; errors: number };
  tiles(form: Form, rows: Rows): Tiles
  type OpenEntry = { code: string; value: AnswerValue; thread: Thread | null };
  type OpenSection = { number: number; question: OpenQuestion; entries: OpenEntry[] };
  openAnswers(form: Form, rows: Rows): OpenSection[]
  type SkipReason = { number: number; kind: "is" | "every"; option: Option };
  type ResponseItem =
    | { number: number; question: Question; state: "skipped"; because: SkipReason | null }
    | { number: number; question: Question; state: "answered"; value: AnswerValue; thread: Thread | null };
  type ResponseView = { code: string; position: number; total: number; previous: string | null; next: string | null; lang: Lang; minutes: number; followUps: number; items: ResponseItem[] };
  responseView(form: Form, rows: Rows, code: string): ResponseView | null
  ```

- [ ] **Step 1: Write the fixture**

`tests/results-fixture.ts`:

```ts
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
```

(`retired-option` in R1's `cost` is Review Focus 4: an id the form does not have.)

- [ ] **Step 2: Write the failing test**

`tests/results.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FORM } from "@/form";
import {
  countedResponses, firstCode, openAnswers, percent, questionResults, responseView,
  resultsLang, shareLabel, tiles, withLang, type QuestionResult,
} from "@/results";
import { EMAIL, R1, R2, UID, rows } from "./results-fixture";

const EMPTY = { responses: [], answers: [], probe_calls: [] };
const result = (id: string): QuestionResult => questionResults(FORM, rows).find((r) => r.question.id === id)!;
const counts = (id: string) => {
  const r = result(id);
  return r.type === "single" || r.type === "multi" ? Object.fromEntries(r.counts.map((c) => [c.option.id, c.count])) : null;
};

describe("small helpers", () => {
  it("reads ?l= as German only when it says de, once", () => {
    expect(resultsLang("de")).toBe("de");
    expect(resultsLang("en")).toBe("en");
    expect(resultsLang(undefined)).toBe("en");
    expect(resultsLang(["de", "de"])).toBe("en");
  });

  it("keeps ?l=de on links", () => {
    expect(withLang("/admin/results/open", "de")).toBe("/admin/results/open?l=de");
    expect(withLang("/admin/results/open", "en")).toBe("/admin/results/open");
  });

  it("puts the count before the share, and never divides by zero", () => {
    expect(shareLabel(3, 5)).toBe("3 / 5 · 60%");
    expect(shareLabel(0, 0)).toBe("0 / 0");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("countedResponses", () => {
  it("keeps completed responses of this form version, without the smoke test's, in order of completion", () => {
    expect(countedResponses(FORM, rows.responses).map((r) => r.id)).toEqual([R1, R2]);
    expect(firstCode(FORM, rows)).toBe("aaaa0001");
    expect(firstCode(FORM, EMPTY)).toBeNull();
  });
});

describe("questionResults", () => {
  it("numbers all fourteen questions in form order", () => {
    expect(questionResults(FORM, rows).map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("counts single and multiple choices over n, which the skip rules lower", () => {
    expect(result("role").n).toBe(2);
    expect(counts("role")).toEqual({ owner: 1, sales: 0, purchasing: 1, other: 0 });
    expect(result("duration").n).toBe(1);
    expect(result("sources").n).toBe(1);
    expect(counts("skipped")).toMatchObject({ "no-time": 1, none: 1 });
    expect(counts("followup")).toEqual({ conversation: 1, trial: 0, neither: 1 });
  });

  it("ignores an option id the form no longer has", () => {
    expect(counts("cost")).toEqual({ no: 0, "paid-report": 1, subscription: 0, "outside-help": 0, "dont-know": 0 });
  });

  it("counts each row of the rows question over its scale", () => {
    const r = result("activities");
    if (r.type !== "rows") throw new Error("rows expected");
    const competitors = r.rows.find((x) => x.row.id === "competitors")!;
    expect(Object.fromEntries(competitors.counts.map((c) => [c.option.id, c.count]))).toEqual({ never: 2, "1-2": 0, "3-6": 0, monthly: 0, weekly: 0 });
  });

  it("summarises the open questions without their text", () => {
    expect(result("case")).toMatchObject({ n: 2, written: 1, escaped: 1, followedUp: 1, followUps: 1 });
    expect(result("pains")).toMatchObject({ n: 2, written: 2, escaped: 0, followedUp: 1, followUps: 1 });
    expect(result("gains")).toMatchObject({ n: 1, written: 1, followedUp: 1, followUps: 2 });
  });

  it("gives n = 0 everywhere when nothing is completed yet", () => {
    expect(questionResults(FORM, EMPTY).every((r) => r.n === 0)).toBe(true);
  });
});

describe("tiles", () => {
  it("counts the completed responses, their time, follow-ups and model calls", () => {
    expect(tiles(FORM, rows)).toEqual({ completed: 2, medianMinutes: 16, followUps: 4, calls: 7, stops: 3, errors: 0 });
    expect(tiles(FORM, EMPTY)).toEqual({ completed: 0, medianMinutes: null, followUps: 0, calls: 0, stops: 0, errors: 0 });
  });
});

describe("openAnswers", () => {
  it("lists each counted answer of each open question with its thread", () => {
    const sections = openAnswers(FORM, rows);
    expect(sections.map((s) => [s.number, s.question.id, s.entries.length])).toEqual([[4, "case", 2], [8, "pains", 2], [9, "gains", 1]]);
    const [first, escaped] = sections[0].entries;
    expect(first.code).toBe("aaaa0001");
    expect(first.thread?.steps[0].decisions[0].followUp).toBe("Welche Quellen haben Sie dafür genutzt?");
    expect(escaped).toEqual({ code: "aaaa0002", value: { option: "none" }, thread: null });
    expect(sections[2].entries[0].thread?.end).toBe("limit");
  });
});

describe("responseView", () => {
  it("gives one response in form order, with its neighbours", () => {
    const view = responseView(FORM, rows, "aaaa0002")!;
    expect(view).toMatchObject({ code: "aaaa0002", position: 2, total: 2, previous: "aaaa0001", next: null, lang: "de", minutes: 20, followUps: 1 });
    expect(view.items).toHaveLength(14);
  });

  it("says which rule skipped a question", () => {
    const view = responseView(FORM, rows, "aaaa0002")!;
    const duration = view.items.find((i) => i.question.id === "duration")!;
    expect(duration).toMatchObject({ state: "skipped", because: { number: 4, kind: "is", option: { id: "none" } } });
    const sources = view.items.find((i) => i.question.id === "sources")!;
    expect(sources).toMatchObject({ state: "skipped", because: { number: 10, kind: "every", option: { id: "never" } } });
  });

  it("drops the e-mail address and never carries the company number", () => {
    const view = responseView(FORM, rows, "aaaa0001")!;
    expect(view.items.find((i) => i.question.id === "followup")).toMatchObject({ state: "answered", value: { options: ["conversation"] } });
    const text = JSON.stringify([view, questionResults(FORM, rows), openAnswers(FORM, rows), tiles(FORM, rows)]);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(UID);
  });

  it("returns null for a code that is not a counted response", () => {
    expect(responseView(FORM, rows, "aaaa0003")).toBeNull();
    expect(responseView(FORM, rows, "ffffffff")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/results.test.ts`
Expected: FAIL, cannot resolve `@/results`.

- [ ] **Step 4: Write the code**

In `src/engine.ts`, export `holds` (add `export` before `function holds`). In `src/stats.ts`, export `median` (add `export` before `function median`).

`src/results.ts`:

```ts
// What the results pages show, computed from the rows of the three tables:
// which responses count, n and the counts per question, the tiles, the open
// answers with their threads, and one response in words (design note
// docs/design/2026-09-28-results-dashboard.md §2–§4). Pure functions, tested
// without a database. Nothing here returns a company number or an e-mail
// address; those leave only through contacts.ts.
import type { ResponseRow, StoredAnswer, StoredCall } from "@/db";
import { AnswerValueSchema, holds, type AnswerValue, type Answers } from "@/engine";
import type { Form, MultiQuestion, OpenQuestion, Option, Question, RowsQuestion, SingleQuestion } from "@/form";
import type { Lang } from "@/i18n";
import { fixedAnswers, referenceCode, SMOKE_TAG } from "@/responses";
import { median } from "@/stats";
import { buildThread, type Thread } from "@/threads";

export type Rows = { responses: ResponseRow[]; answers: StoredAnswer[]; probe_calls: StoredCall[] };

/** ?l=de shows the texts participants saw; anything else is English. */
export function resultsLang(value: string | string[] | undefined): Lang {
  return value === "de" ? "de" : "en";
}

/** A results link that keeps the language of the question texts. */
export function withLang(path: string, lang: Lang): string {
  return lang === "de" ? `${path}?l=de` : path;
}

export function percent(count: number, n: number): number {
  return n === 0 ? 0 : Math.round((count / n) * 100);
}

/** The count first, the share second: with a small n a share alone misleads. */
export function shareLabel(count: number, n: number): string {
  return n === 0 ? "0 / 0" : `${count} / ${n} · ${percent(count, n)}%`;
}

/** Completed responses of this form version, without the smoke test's, in order of completion. */
export function countedResponses(form: Form, responses: ResponseRow[]): ResponseRow[] {
  return responses
    .filter((r) => r.completed_at !== null && r.form_version === form.version && r.company_uid !== SMOKE_TAG)
    .sort((a, b) => Date.parse(a.completed_at!) - Date.parse(b.completed_at!));
}

/** The reference code the Responses tab opens, or null before the first completion. */
export function firstCode(form: Form, rows: Rows): string | null {
  const first = countedResponses(form, rows.responses)[0];
  return first ? referenceCode(first.id) : null;
}

/** An option, escape option, scale step or row of a question, by id. */
export function optionOf(question: Question, id: string): Option | undefined {
  if (question.type === "open") return question.escape?.id === id ? question.escape : undefined;
  if (question.type === "rows") return question.scale.find((o) => o.id === id) ?? question.rows.find((o) => o.id === id);
  return question.options.find((o) => o.id === id);
}

const minutes = (r: ResponseRow) => (Date.parse(r.completed_at!) - Date.parse(r.created_at)) / 60_000;
const chosen = (v: AnswerValue): string[] => ("option" in v ? [v.option] : "options" in v ? v.options : []);
const withoutEmail = (v: AnswerValue): AnswerValue => ("options" in v ? { options: v.options } : v);

/** The counted responses, their ids, and the answer rows that belong to them. */
function counted(form: Form, rows: Rows) {
  const responses = countedResponses(form, rows.responses);
  const ids = new Set(responses.map((r) => r.id));
  return { responses, ids, answers: rows.answers.filter((a) => ids.has(a.response_id)) };
}

export type OptionCount = { option: Option; count: number };

export type QuestionResult =
  | { type: "single" | "multi"; number: number; question: SingleQuestion | MultiQuestion; n: number; counts: OptionCount[] }
  | { type: "rows"; number: number; question: RowsQuestion; n: number; rows: { row: Option; counts: OptionCount[] }[] }
  | { type: "open"; number: number; question: OpenQuestion; n: number; written: number; escaped: number; followedUp: number; followUps: number };

export function questionResults(form: Form, rows: Rows): QuestionResult[] {
  const { responses, answers } = counted(form, rows);
  const fixed = responses.map((r) => fixedAnswers(answers.filter((a) => a.response_id === r.id)));
  return form.questions.map((question, i): QuestionResult => {
    const number = i + 1;
    const values = fixed.map((f) => f[question.id]).filter((v): v is AnswerValue => v !== undefined);
    const n = values.length;
    if (question.type === "single" || question.type === "multi") {
      const picks = values.map(chosen);
      return { type: question.type, number, question, n, counts: question.options.map((option) => ({ option, count: picks.filter((p) => p.includes(option.id)).length })) };
    }
    if (question.type === "rows") {
      return {
        type: "rows", number, question, n,
        rows: question.rows.map((row) => ({
          row,
          counts: question.scale.map((option) => ({ option, count: values.filter((v) => "rows" in v && v.rows[row.id] === option.id).length })),
        })),
      };
    }
    const escaped = values.filter((v) => "option" in v).length;
    const replies = answers.filter((a) => a.question_id === question.id && a.followup_index > 0);
    return {
      type: "open", number, question, n, written: n - escaped, escaped,
      followedUp: new Set(replies.map((a) => a.response_id)).size,
      followUps: replies.length,
    };
  });
}

export type Tiles = { completed: number; medianMinutes: number | null; followUps: number; calls: number; stops: number; errors: number };

export function tiles(form: Form, rows: Rows): Tiles {
  const { responses, ids, answers } = counted(form, rows);
  const calls = rows.probe_calls.filter((c) => ids.has(c.response_id));
  return {
    completed: responses.length,
    medianMinutes: median(responses.map(minutes)),
    followUps: answers.filter((a) => a.followup_index > 0).length,
    calls: calls.length,
    stops: calls.filter((c) => c.decision === "stop").length,
    errors: calls.filter((c) => c.decision === "error" || c.decision === "rejected").length,
  };
}

export type OpenEntry = { code: string; value: AnswerValue; thread: Thread | null };
export type OpenSection = { number: number; question: OpenQuestion; entries: OpenEntry[] };

function openEntry(question: OpenQuestion, response: ResponseRow, rows: Rows): OpenEntry | null {
  const own = rows.answers.filter((a) => a.response_id === response.id && a.question_id === question.id);
  const main = own.find((a) => a.followup_index === 0);
  const parsed = AnswerValueSchema.safeParse(main?.value);
  if (!main || !parsed.success) return null;
  const calls = rows.probe_calls.filter((c) => c.response_id === response.id && c.question_id === question.id);
  const thread = "text" in parsed.data
    ? buildThread(main, own.filter((a) => a.followup_index > 0), calls, question.probe?.maxFollowUps ?? 0)
    : null;
  return { code: referenceCode(response.id), value: parsed.data, thread };
}

export function openAnswers(form: Form, rows: Rows): OpenSection[] {
  const responses = countedResponses(form, rows.responses);
  return form.questions.flatMap((question, i) =>
    question.type !== "open"
      ? []
      : [{
          number: i + 1,
          question,
          entries: responses.flatMap((r) => {
            const entry = openEntry(question, r, rows);
            return entry ? [entry] : [];
          }),
        }],
  );
}

export type SkipReason = { number: number; kind: "is" | "every"; option: Option };

export type ResponseItem =
  | { number: number; question: Question; state: "skipped"; because: SkipReason | null }
  | { number: number; question: Question; state: "answered"; value: AnswerValue; thread: Thread | null };

export type ResponseView = {
  code: string; position: number; total: number; previous: string | null; next: string | null;
  lang: Lang; minutes: number; followUps: number; items: ResponseItem[];
};

function skipReason(form: Form, questionId: string, answers: Answers): SkipReason | null {
  const rule = form.skips.find((s) => s.skip.includes(questionId) && holds(s.when, answers));
  if (!rule) return null;
  const index = form.questions.findIndex((q) => q.id === rule.when.question);
  const kind = "is" in rule.when ? "is" : "every";
  const option = optionOf(form.questions[index], "is" in rule.when ? rule.when.is : rule.when.every);
  return option ? { number: index + 1, kind, option } : null;
}

export function responseView(form: Form, rows: Rows, code: string): ResponseView | null {
  const responses = countedResponses(form, rows.responses);
  const index = responses.findIndex((r) => referenceCode(r.id) === code);
  if (index === -1) return null;
  const response = responses[index];
  const own = rows.answers.filter((a) => a.response_id === response.id);
  const fixed = fixedAnswers(own);
  const items = form.questions.map((question, i): ResponseItem => {
    const value = fixed[question.id];
    if (value === undefined) return { number: i + 1, question, state: "skipped", because: skipReason(form, question.id, fixed) };
    const thread = question.type === "open" ? (openEntry(question, response, rows)?.thread ?? null) : null;
    return { number: i + 1, question, state: "answered", value: withoutEmail(value), thread };
  });
  return {
    code,
    position: index + 1,
    total: responses.length,
    previous: index > 0 ? referenceCode(responses[index - 1].id) : null,
    next: index < responses.length - 1 ? referenceCode(responses[index + 1].id) : null,
    lang: response.lang,
    minutes: Math.round(minutes(response)),
    followUps: own.filter((a) => a.followup_index > 0).length,
    items,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/results.test.ts tests/engine.test.ts tests/stats.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine.ts src/stats.ts src/results.ts tests/results-fixture.ts tests/results.test.ts
git commit -m "feat: count results per question and response (#31)"
```

---

### Task 4: The contacts list

**Files:**
- Create: `src/contacts.ts`
- Test: `tests/contacts.test.ts`

**Interfaces:**
- Consumes: `countedResponses` (Task 3), `ResponseRow`, `StoredAnswer` (Task 1).
- Produces: `type Contact = { code: string; tag: string | null; email: string | null; openTo: Option[]; completedAt: string }`, `contacts(form: Form, responses: ResponseRow[], answers: StoredAnswer[]): Contact[]`.

- [ ] **Step 1: Write the failing test**

`tests/contacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contacts } from "@/contacts";
import { FORM } from "@/form";
import { EMAIL, UID, answers, responses } from "./results-fixture";

describe("contacts", () => {
  it("lists only the people who asked to be contacted, with their tag and address", () => {
    expect(contacts(FORM, responses, answers)).toEqual([
      {
        code: "aaaa0001",
        tag: UID,
        email: EMAIL,
        openTo: [expect.objectContaining({ id: "conversation" })],
        completedAt: "2026-10-01T08:12:00+00:00",
      },
    ]);
  });

  it("is empty when no one asked", () => {
    expect(contacts(FORM, [], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/contacts.test.ts`
Expected: FAIL, cannot resolve `@/contacts`.

- [ ] **Step 3: Write the code**

`src/contacts.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/contacts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/contacts.ts tests/contacts.test.ts
git commit -m "feat: list the people who asked to be contacted (#31)"
```

---

### Task 5: Overview page, shared components, print styles

**Files:**
- Create: `src/components/Tile.tsx` (moved out of `src/app/admin/page.tsx`)
- Modify: `src/app/admin/page.tsx` (import `Tile`, link to the results, header comment)
- Create: `src/components/results/ResultsHeader.tsx`, `src/components/results/QuestionCard.tsx`, `src/components/results/OptionBars.tsx`, `src/components/results/RowsChart.tsx`, `src/components/results/ResultCard.tsx`
- Create: `src/app/admin/results/page.tsx`
- Modify: `src/app/globals.css` (print block at the end)
- Test: `tests/components/ResultsPages.test.tsx`

**Interfaces:**
- Consumes: `readAll` (Task 1); `questionResults`, `tiles`, `firstCode`, `resultsLang`, `withLang`, `percent`, `shareLabel`, `QuestionResult`, `OptionCount` (Task 3).
- Produces: `Tile({ label, value, hint? })`; `ResultsHeader({ tab, path, lang, first, asOf })` with `type Tab = "overview" | "open" | "responses" | "contacts"`; `QuestionCard({ number, text, n, note?, children })`; default export `ResultsPage({ searchParams })`. Later tasks import `ResultsHeader` and `QuestionCard`.

- [ ] **Step 1: Write the failing test**

`tests/components/ResultsPages.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/db", async () => {
  const f = await import("../results-fixture");
  return { readAll: vi.fn(async () => f.rows) };
});
import * as db from "@/db";
import ResultsPage from "@/app/admin/results/page";
import { EMAIL, UID } from "../results-fixture";

const search = (l?: string) => ({ searchParams: Promise.resolve(l ? { l } : {}) });

describe("the results overview", () => {
  it("shows the tiles and all fourteen questions, counts first", async () => {
    render(await ResultsPage(search()));
    expect(screen.getByRole("heading", { level: 1, name: "Survey results — form 2.0.0" })).toBeInTheDocument();
    expect(screen.getByText("Completed").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Your role")).toBeInTheDocument();
    expect(screen.getAllByText("1 / 2 · 50%").length).toBeGreaterThan(0);
  });

  it("links each open question to its answers", async () => {
    render(await ResultsPage(search()));
    const link = screen.getByRole("link", { name: /Think of the last time/ });
    expect(link).toHaveAttribute("href", "/admin/results/open#case");
    expect(link).toHaveTextContent("Read the 1 answer and the AI follow-ups →");
    expect(screen.getByText(/1 answered · 1 chose/)).toBeInTheDocument();
  });

  it("shows the texts participants saw with ?l=de, and keeps it on the links", async () => {
    render(await ResultsPage(search("de")));
    expect(screen.getByText("Ihre Rolle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open answers" })).toHaveAttribute("href", "/admin/results/open?l=de");
  });

  it("never shows a company number or an e-mail address", async () => {
    const { container } = render(await ResultsPage(search()));
    expect(container.textContent).not.toContain(UID);
    expect(container.textContent).not.toContain(EMAIL);
  });

  it("renders before the first completed response, without a Responses tab", async () => {
    vi.mocked(db.readAll).mockResolvedValueOnce({ responses: [], answers: [], probe_calls: [] });
    render(await ResultsPage(search()));
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Responses" })).toBeNull();
    expect(document.body.textContent).not.toContain("NaN");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/components/ResultsPages.test.tsx`
Expected: FAIL, cannot resolve `@/app/admin/results/page`.

- [ ] **Step 3: Move `Tile`**

`src/components/Tile.tsx`:

```tsx
// One number on the admin and results pages, with its label and an optional hint.
export function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-white/70 p-4 break-inside-avoid">
      <span className="text-sm text-body">{label}</span>
      <span className="text-3xl font-semibold tabular-nums text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
```

In `src/app/admin/page.tsx`: delete the local `Tile` function, add `import { Tile } from "@/components/Tile";`, replace the header comment with:

```tsx
// /admin — Koray's page, behind the password in src/proxy.ts: how many
// responses there are, the invitation link maker, and the way to the results
// (/admin/results, which shows answers by reference code). This page shows
// no answer text and no company number. Rendered on every request (the
// numbers change), never cached, never indexed.
```

and under the `<header>` add:

```tsx
      <a href="/admin/results" className="self-start text-sm font-medium text-accent underline-offset-4 hover:underline">
        Read the results →
      </a>
```

- [ ] **Step 4: Write the components**

`src/components/results/ResultsHeader.tsx`:

```tsx
// The top of every results page: the title, when the rows were read, the
// tabs, and the switch between English and German question texts. The tabs
// are plain links (each page is its own request); none of them is printed.
import { FORM_VERSION } from "@/form";
import type { Lang } from "@/i18n";
import { withLang } from "@/results";

export type Tab = "overview" | "open" | "responses" | "contacts";

type Props = { tab: Tab; path: string; lang: Lang; first: string | null; asOf: Date };

export function ResultsHeader({ tab, path, lang, first, asOf }: Props) {
  const tabs: { id: Tab; label: string; href: string | null }[] = [
    { id: "overview", label: "Overview", href: "/admin/results" },
    { id: "open", label: "Open answers", href: "/admin/results/open" },
    { id: "responses", label: "Responses", href: first ? `/admin/results/${first}` : null },
    { id: "contacts", label: "Contacts", href: "/admin/results/contacts" },
  ];
  const time = asOf.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "medium", timeStyle: "short" });
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Survey results — form {FORM_VERSION}</h1>
        <p className="text-sm text-body">As of {time}. Completed responses only.</p>
      </div>
      <nav aria-label="Results" className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-border text-sm print:hidden">
        {tabs.map((item) =>
          item.href === null ? null : (
            <a
              key={item.id}
              href={withLang(item.href, lang)}
              aria-current={item.id === tab ? "page" : undefined}
              className={item.id === tab ? "-mb-px border-b-2 border-accent pb-2 text-foreground" : "pb-2 text-body hover:text-foreground"}
            >
              {item.label}
            </a>
          ),
        )}
        <a href={withLang(path, lang === "de" ? "en" : "de")} className="ml-auto pb-2 text-muted-foreground hover:text-foreground">
          {lang === "de" ? "Question texts in English" : "Question texts in German"}
        </a>
      </nav>
    </header>
  );
}
```

`src/components/results/QuestionCard.tsx`:

```tsx
// One question on the results pages: its number in the margin, its text, and
// n at the top right; the chart or summary goes inside. Never split across
// printed pages.
export function QuestionCard({ number, text, n, note, children }: {
  number: number;
  text: string;
  n: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[1.75rem_1fr] gap-x-4 rounded-xl border border-border bg-white/70 p-5 break-inside-avoid sm:grid-cols-[2.5rem_1fr]">
      <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">{number}</span>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-medium text-foreground">{text}</h3>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">n = {n}</span>
        </div>
        {note && <p className="-mt-2 text-xs text-muted-foreground">{note}</p>}
        {children}
      </div>
    </section>
  );
}
```

`src/components/results/OptionBars.tsx`:

```tsx
// One horizontal bar per option, in form order: a thin accent bar on a pale
// track that stands for n, then "count / n · share".
import { t, type Lang } from "@/i18n";
import { percent, shareLabel, type OptionCount } from "@/results";

export function OptionBars({ counts, n, lang }: { counts: OptionCount[]; n: number; lang: Lang }) {
  return (
    <ul className="flex flex-col gap-3">
      {counts.map(({ option, count }) => (
        <li key={option.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,15rem)_1fr_7rem]">
          <span className="text-body">{t(option.label, lang)}</span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-border/70">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${percent(count, n)}%` }} />
          </span>
          <span className="tabular-nums text-foreground sm:text-right">{shareLabel(count, n)}</span>
        </li>
      ))}
    </ul>
  );
}
```

`src/components/results/RowsChart.tsx`:

```tsx
// The rows question (statements on one frequency scale): one 100% stacked
// bar per statement in five tints of the accent colour, counts inside the
// segments, one legend, and the same numbers as a table for exact reading.
import { Fragment } from "react";
import type { Option, RowsQuestion } from "@/form";
import { t, type Lang } from "@/i18n";
import { percent, shareLabel, type OptionCount } from "@/results";

const TINTS = [
  "bg-accent/20 text-foreground",
  "bg-accent/40 text-foreground",
  "bg-accent/60 text-white",
  "bg-accent/80 text-white",
  "bg-accent text-white",
];
const tint = (i: number) => TINTS[Math.min(i, TINTS.length - 1)];

export function RowsChart({ question, rows, n, lang }: {
  question: RowsQuestion;
  rows: { row: Option; counts: OptionCount[] }[];
  n: number;
  lang: Lang;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-body">
        {question.scale.map((step, i) => (
          <li key={step.id} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${tint(i)}`} />
            {t(step.label, lang)}
          </li>
        ))}
      </ul>
      {rows.map(({ row, counts }) => (
        <div key={row.id} className="flex flex-col gap-1.5">
          <span className="text-sm text-body">{t(row.label, lang)}</span>
          <div className="flex h-7 overflow-hidden rounded-md bg-border/70 text-xs tabular-nums">
            {counts.map(({ option, count }, i) =>
              count === 0 ? null : (
                <span
                  key={option.id}
                  title={`${t(option.label, lang)}: ${shareLabel(count, n)}`}
                  className={`flex items-center justify-center ${tint(i)}`}
                  style={{ width: `${percent(count, n)}%` }}
                >
                  {count}
                </span>
              ),
            )}
          </div>
        </div>
      ))}
      <details className="text-sm print:hidden">
        <summary className="cursor-pointer text-muted-foreground">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal" />
              {question.scale.map((step) => <th key={step.id} className="py-1 text-right font-normal">{t(step.label, lang)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ row, counts }) => (
              <tr key={row.id}>
                <td className="py-1 pr-4 text-body">{t(row.label, lang)}</td>
                {counts.map(({ option, count }) => (
                  <Fragment key={option.id}>
                    <td className="py-1 text-right tabular-nums">{count}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
```

`src/components/results/ResultCard.tsx`:

```tsx
// One question of the overview, whatever its type: bars for single and
// multiple choice, stacked bars for the rows question, and for an open
// question a summary card that links to its answers.
import { t, type Lang } from "@/i18n";
import { withLang, type QuestionResult } from "@/results";
import { OptionBars } from "./OptionBars";
import { QuestionCard } from "./QuestionCard";
import { RowsChart } from "./RowsChart";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ResultCard({ result, lang }: { result: QuestionResult; lang: Lang }) {
  const text = t(result.question.text, lang);
  if (result.type === "rows") {
    return (
      <QuestionCard number={result.number} text={text} n={result.n}>
        <RowsChart question={result.question} rows={result.rows} n={result.n} lang={lang} />
      </QuestionCard>
    );
  }
  if (result.type === "open") {
    const escape = result.question.escape;
    const parts = [`${result.written} answered`];
    if (escape) parts.push(`${result.escaped} chose “${t(escape.label, lang)}”`);
    parts.push(`${result.followedUp} got an AI follow-up (${result.followUps} in all)`);
    return (
      <a href={`${withLang("/admin/results/open", lang)}#${result.question.id}`} className="block rounded-xl hover:[&>section]:border-accent/40">
        <QuestionCard number={result.number} text={text} n={result.n}>
          <p className="text-sm text-body">{parts.join(" · ")}</p>
          <span className="text-sm font-medium text-accent">Read the {plural(result.written, "answer")} and the AI follow-ups →</span>
        </QuestionCard>
      </a>
    );
  }
  return (
    <QuestionCard number={result.number} text={text} n={result.n} note={result.type === "multi" ? "Several answers possible; shares are of n." : undefined}>
      <OptionBars counts={result.counts} n={result.n} lang={lang} />
    </QuestionCard>
  );
}
```

- [ ] **Step 5: Write the page**

`src/app/admin/results/page.tsx`:

```tsx
// /admin/results — the overview: tiles, then the fourteen questions in form
// order; bars for the closed ones, a summary card linking to the answers for
// the open ones. Behind the admin password (src/proxy.ts), rendered on every
// request. Design: docs/design/2026-09-28-results-dashboard.md.
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultCard } from "@/components/results/ResultCard";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { Tile } from "@/components/Tile";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { firstCode, questionResults, resultsLang, tiles } from "@/results";

export const metadata: Metadata = { title: "Results", robots: { index: false, follow: false } };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const s = tiles(FORM, rows);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="overview" path="/admin/results" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Completed" value={s.completed} />
        <Tile label="Median time" value={s.medianMinutes === null ? "–" : `${Math.round(s.medianMinutes)} min`} />
        <Tile label="Follow-ups asked" value={s.followUps} />
        <Tile label="Model calls" value={s.calls} hint={`${s.stops} stops, ${s.errors} errors`} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">Questions</h2>
      {questionResults(FORM, rows).map((result) => (
        <ResultCard key={result.question.id} result={result} lang={lang} />
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Add the print styles**

At the end of `src/app/globals.css`:

```css
/* Printing the results for the supervisors: A4, no page gradient, and the
   bars keep their colour even when the browser leaves out background
   graphics. */
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body { background: none; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  h2, h3 { break-after: avoid; }
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/components/ResultsPages.test.tsx tests/components/AdminPage.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/Tile.tsx src/components/results src/app/admin/page.tsx src/app/admin/results/page.tsx src/app/globals.css tests/components/ResultsPages.test.tsx
git commit -m "feat: results overview under /admin/results (#31)"
```

---

### Task 6: Open answers and one response

**Files:**
- Create: `src/components/results/ThreadView.tsx` (exports `ThreadView` and `OpenAnswer`)
- Create: `src/components/results/AnswerView.tsx`
- Create: `src/app/admin/results/open/page.tsx`
- Create: `src/app/admin/results/[code]/page.tsx`
- Test: `tests/components/ResultsPages.test.tsx` (add two `describe` blocks)

**Interfaces:**
- Consumes: `Thread` (Task 2); `openAnswers`, `responseView`, `optionOf`, `firstCode`, `resultsLang`, `withLang`, `ResponseItem` (Task 3); `ResultsHeader` (Task 5).
- Produces: `ThreadView({ text, thread })`, `OpenAnswer({ question, value, thread, lang })`, `AnswerView({ item, lang })`; default exports `OpenAnswersPage({ searchParams })` and `ResponsePage({ params, searchParams })`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/ResultsPages.test.tsx` (imports at the top of the file, blocks at the end):

```tsx
import OpenAnswersPage from "@/app/admin/results/open/page";
import ResponsePage from "@/app/admin/results/[code]/page";

const code = (c: string, l?: string) => ({ params: Promise.resolve({ code: c }), ...search(l) });

describe("the open answers page", () => {
  it("shows each answer with the AI's follow-ups and reasons", async () => {
    render(await OpenAnswersPage(search()));
    expect(screen.getByText("Welche Quellen haben Sie dafür genutzt?")).toBeInTheDocument();
    expect(screen.getByText(/Why: The need is named but no step or source\./)).toBeInTheDocument();
    expect(screen.getByText(/the limit of 2 follow-ups was reached/)).toBeInTheDocument();
    expect(screen.getByText(/No further question — The answer names a difficulty\. \(made on an earlier version of the answer\)/)).toBeInTheDocument();
    expect(document.getElementById("pains")).not.toBeNull();
  });

  it("shows markup in an answer as text", async () => {
    render(await OpenAnswersPage(search()));
    expect(screen.getByText(/<b>nirgends<\/b> steht es/)).toBeInTheDocument();
  });

  it("never shows a company number or an e-mail address", async () => {
    const { container } = render(await OpenAnswersPage(search()));
    expect(container.textContent).not.toContain(UID);
    expect(container.textContent).not.toContain(EMAIL);
  });
});

describe("the response page", () => {
  it("shows one response in words, with the skipped questions and neighbours", async () => {
    render(await ResponsePage(code("aaaa0002")));
    expect(screen.getByRole("heading", { name: "Response aaaa0002" })).toBeInTheDocument();
    expect(screen.getAllByText(/question 4 was answered “I can't think of such a case\.”/).length).toBe(4);
    expect(screen.getByText(/every row of question 10 was “Never”/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "← previous" })[0]).toHaveAttribute("href", "/admin/results/aaaa0001");
  });

  it("never shows a company number or an e-mail address", async () => {
    for (const c of ["aaaa0001", "aaaa0002"]) {
      const { container, unmount } = render(await ResponsePage(code(c)));
      expect(container.textContent).not.toContain(UID);
      expect(container.textContent).not.toContain(EMAIL);
      unmount();
    }
  });

  it("gives 404 for a malformed code without reading the database", async () => {
    vi.mocked(db.readAll).mockClear();
    for (const c of ["AAAA0002", "aaaa0002x", "../x"]) {
      await expect(ResponsePage(code(c))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(db.readAll).not.toHaveBeenCalled();
  });

  it("gives 404 for a code that is not a counted response", async () => {
    await expect(ResponsePage(code("aaaa0003"))).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/components/ResultsPages.test.tsx`
Expected: FAIL, cannot resolve the two new pages.

- [ ] **Step 3: Write the components**

`src/components/results/ThreadView.tsx`:

```tsx
// An open answer and its follow-ups as a transcript: the answer, each model
// decision with its reason, each reply (design note §5). The AI's questions
// carry the accent colour; stops, rejections and errors are muted. Reasons are
// the model's own, as given at the time of the call.
import type { AnswerValue } from "@/engine";
import type { OpenQuestion } from "@/form";
import { t, type Lang } from "@/i18n";
import { optionOf } from "@/results";
import type { Decision, Thread } from "@/threads";

function Turn({ label, accent = false, muted = false, children }: { label: string; accent?: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className={`pt-0.5 text-xs ${accent ? "font-medium text-accent" : "text-muted-foreground"}`}>{label}</dt>
      <dd className={`border-l-2 pl-4 whitespace-pre-wrap ${accent ? "border-accent" : "border-border"} ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {children}
      </dd>
    </>
  );
}

function DecisionTurn({ index, decision }: { index: number; decision: Decision }) {
  const earlier = decision.stale ? " (made on an earlier version of the answer)" : "";
  if (decision.decision === "ask") {
    return (
      <Turn label={`AI follow-up ${index}`} accent>
        {decision.followUp}
        <span className="mt-1 block text-xs text-muted-foreground">Why: {decision.reason}{earlier}</span>
      </Turn>
    );
  }
  if (decision.decision === "error") {
    return <Turn label="AI" muted>{`No follow-up — the model call failed (${decision.errorClass ?? "unknown"})${earlier}.`}</Turn>;
  }
  if (decision.decision === "rejected") {
    return <Turn label="AI" muted>{`A follow-up was written but failed the check — ${decision.reason}${earlier}`}</Turn>;
  }
  return <Turn label="AI" muted>{`No further question — ${decision.reason}${earlier}`}</Turn>;
}

export function ThreadView({ text, thread }: { text: string; thread: Thread | null }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-sm sm:grid-cols-[7.5rem_1fr]">
      <Turn label="Answer">{text}</Turn>
      {thread?.steps.map((step) => (
        <DecisionsAndReply key={step.index} step={step} />
      ))}
      {thread?.end === "limit" && <Turn label="Rule" muted>{`No further question — the limit of ${thread.max} follow-ups was reached.`}</Turn>}
      {thread?.end === "no-call" && <Turn label="AI" muted>No further model call.</Turn>}
    </dl>
  );
}

function DecisionsAndReply({ step }: { step: Thread["steps"][number] }) {
  return (
    <>
      {step.decisions.map((decision, i) => (
        <DecisionTurn key={i} index={step.index} decision={decision} />
      ))}
      {step.reply && <Turn label={`Reply ${step.index}`}>{step.reply.text}</Turn>}
    </>
  );
}

/** A written answer with its thread, or the escape option it chose. */
export function OpenAnswer({ question, value, thread, lang }: { question: OpenQuestion; value: AnswerValue; thread: Thread | null; lang: Lang }) {
  if ("text" in value) return <ThreadView text={value.text} thread={thread} />;
  const option = "option" in value ? optionOf(question, value.option) : undefined;
  return <p className="text-sm text-muted-foreground">Chose “{option ? t(option.label, lang) : "—"}”; no follow-up is asked.</p>;
}
```

`src/components/results/AnswerView.tsx`:

```tsx
// One answer of one response, in the words participants saw: a skipped
// question with the rule that skipped it, a choice, a list of choices, the
// rows question row by row, or an open answer with its thread.
import { Fragment } from "react";
import type { Option } from "@/form";
import { t, type Lang } from "@/i18n";
import { optionOf, type ResponseItem } from "@/results";
import { OpenAnswer } from "./ThreadView";

export function AnswerView({ item, lang }: { item: ResponseItem; lang: Lang }) {
  if (item.state === "skipped") {
    if (!item.because) return <p className="text-sm italic text-muted-foreground">No answer.</p>;
    const label = t(item.because.option.label, lang);
    const why = item.because.kind === "is"
      ? `question ${item.because.number} was answered “${label}”`
      : `every row of question ${item.because.number} was “${label}”`;
    return <p className="text-sm text-muted-foreground"><em>skipped (path)</em>: {why}</p>;
  }
  const { question, value } = item;
  if (question.type === "open") return <OpenAnswer question={question} value={value} thread={item.thread} lang={lang} />;
  if (question.type === "rows" && "rows" in value) {
    return (
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        {question.rows.map((row) => {
          const step = optionOf(question, value.rows[row.id] ?? "");
          return (
            <Fragment key={row.id}>
              <dt className="text-body">{t(row.label, lang)}</dt>
              <dd className="text-foreground">{step ? t(step.label, lang) : "—"}</dd>
            </Fragment>
          );
        })}
      </dl>
    );
  }
  const ids = "option" in value ? [value.option] : "options" in value ? value.options : [];
  const labels = ids
    .map((id) => optionOf(question, id))
    .filter((o): o is Option => o !== undefined)
    .map((o) => t(o.label, lang));
  if (question.type === "multi") {
    return (
      <ul className="list-disc pl-5 text-foreground marker:text-muted-foreground">
        {labels.map((label) => <li key={label}>{label}</li>)}
      </ul>
    );
  }
  return <p className="text-foreground">{labels[0] ?? "—"}</p>;
}
```

- [ ] **Step 4: Write the pages**

`src/app/admin/results/open/page.tsx`:

```tsx
// /admin/results/open — every counted answer to the three open questions,
// each with its AI follow-ups and the model's reasons; anchors #case, #pains
// and #gains for the overview's links. Behind the admin password.
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { OpenAnswer } from "@/components/results/ThreadView";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, openAnswers, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Open answers", robots: { index: false, follow: false } };

export default async function OpenAnswersPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="open" path="/admin/results/open" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <p className="text-sm text-body">Each answer with the AI&apos;s follow-ups. A reason is the model&apos;s own, as given when it was called.</p>
      {openAnswers(FORM, rows).map((section) => (
        <section key={section.question.id} id={section.question.id} className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="mt-4 flex gap-4 text-lg font-semibold text-foreground">
            <span className="tabular-nums text-muted-foreground">{section.number}</span>
            {t(section.question.text, lang)}
          </h2>
          {section.entries.length === 0 && <p className="text-sm text-muted-foreground">No answers yet.</p>}
          {section.entries.map((entry) => (
            <article key={entry.code} className="flex flex-col gap-4 rounded-xl border border-border bg-white/70 p-5 break-inside-avoid">
              <a href={withLang(`/admin/results/${entry.code}`, lang)} className="self-start font-mono text-sm text-accent underline-offset-4 hover:underline">
                {entry.code}
              </a>
              <OpenAnswer question={section.question} value={entry.value} thread={entry.thread} lang={lang} />
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
```

`src/app/admin/results/[code]/page.tsx`:

```tsx
// /admin/results/<code> — one response by its reference code: every
// question in form order with the answer in words, the skipped ones with
// the rule that skipped them, open answers with their threads. No company
// number, no e-mail address (those are on the Contacts page only). A code
// that is not eight lowercase hex characters gives 404 before the database
// is read.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AnswerView } from "@/components/results/AnswerView";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, responseView, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Response", robots: { index: false, follow: false } };

const CODE = /^[0-9a-f]{8}$/;

export default async function ResponsePage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ l?: string | string[] }>;
}) {
  await connection();
  const { code } = await params;
  if (!CODE.test(code)) notFound();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const view = responseView(FORM, rows, code);
  if (!view) notFound();

  const nav = (
    <nav className="flex items-center justify-between text-sm print:hidden">
      <span className="text-muted-foreground">Response {view.position} of {view.total}</span>
      <span className="flex gap-4">
        {view.previous && <a href={withLang(`/admin/results/${view.previous}`, lang)} className="text-accent hover:underline">← previous</a>}
        {view.next && <a href={withLang(`/admin/results/${view.next}`, lang)} className="text-accent hover:underline">next →</a>}
      </span>
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="responses" path={`/admin/results/${code}`} lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      {nav}
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-foreground">Response {view.code}</h2>
        <dl className="flex gap-8 text-sm">
          <div><dt className="text-muted-foreground">Language</dt><dd className="text-foreground">{view.lang === "de" ? "German" : "English"}</dd></div>
          <div><dt className="text-muted-foreground">Time taken</dt><dd className="text-foreground">{view.minutes} min</dd></div>
          <div><dt className="text-muted-foreground">AI follow-ups</dt><dd className="text-foreground">{view.followUps}</dd></div>
        </dl>
      </div>
      <ol className="flex flex-col divide-y divide-border border-t border-border">
        {view.items.map((item) => (
          <li key={item.question.id} className="grid grid-cols-[1.75rem_1fr] gap-x-4 py-5 break-inside-avoid sm:grid-cols-[2.5rem_1fr]">
            <span className="text-sm tabular-nums text-muted-foreground">{item.number}</span>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-body">{t(item.question.text, lang)}</p>
              <AnswerView item={item} lang={lang} />
            </div>
          </li>
        ))}
      </ol>
      {nav}
    </main>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/components/ResultsPages.test.tsx`
Expected: PASS. If the 404 test sees a different message, print the error once and match its `digest` (`NEXT_HTTP_ERROR_FALLBACK;404`) instead.

- [ ] **Step 6: Commit**

```bash
git add src/components/results/ThreadView.tsx src/components/results/AnswerView.tsx "src/app/admin/results/open/page.tsx" "src/app/admin/results/[code]/page.tsx" tests/components/ResultsPages.test.tsx
git commit -m "feat: open answers and one response per page (#31)"
```

---

### Task 7: The Contacts page

**Files:**
- Create: `src/app/admin/results/contacts/page.tsx`
- Test: `tests/components/ResultsPages.test.tsx` (add one `describe` block)

**Interfaces:**
- Consumes: `contacts`, `Contact` (Task 4); `ResultsHeader` (Task 5); `firstCode`, `resultsLang`, `withLang` (Task 3).
- Produces: default export `ContactsPage({ searchParams })`.

- [ ] **Step 1: Write the failing test**

Add to `tests/components/ResultsPages.test.tsx`:

```tsx
import ContactsPage from "@/app/admin/results/contacts/page";

describe("the contacts page", () => {
  it("lists the people who asked to be contacted, with company number and e-mail", async () => {
    render(await ContactsPage(search()));
    expect(screen.getByRole("link", { name: EMAIL })).toHaveAttribute("href", `mailto:${EMAIL}`);
    expect(screen.getByText(UID)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "aaaa0001" })).toHaveAttribute("href", "/admin/results/aaaa0001");
    expect(screen.queryByText("aaaa0002")).toBeNull();
  });

  it("is not printed", async () => {
    const { container } = render(await ContactsPage(search()));
    expect(container.querySelector("table")?.closest(".print\\:hidden")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/components/ResultsPages.test.tsx`
Expected: FAIL, cannot resolve `@/app/admin/results/contacts/page`.

- [ ] **Step 3: Write the page**

`src/app/admin/results/contacts/page.tsx`:

```tsx
// /admin/results/contacts — the people who asked to be contacted, with their
// link's tag (company number or personal code) and e-mail address. The only
// results page that shows either, and it is not printed (design note §2).
import type { Metadata } from "next";
import { connection } from "next/server";
import { ResultsHeader } from "@/components/results/ResultsHeader";
import { contacts } from "@/contacts";
import { readAll } from "@/db";
import { FORM } from "@/form";
import { t } from "@/i18n";
import { firstCode, resultsLang, withLang } from "@/results";

export const metadata: Metadata = { title: "Contacts", robots: { index: false, follow: false } };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ l?: string | string[] }> }) {
  await connection();
  const rows = await readAll();
  const lang = resultsLang((await searchParams).l);
  const list = contacts(FORM, rows.responses, rows.answers);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12 print:px-0 print:py-0">
      <ResultsHeader tab="contacts" path="/admin/results/contacts" lang={lang} first={firstCode(FORM, rows)} asOf={new Date()} />
      <p className="hidden text-sm text-body print:block">The contacts list is not printed.</p>
      <div className="flex flex-col gap-4 print:hidden">
        <p className="text-sm text-body">
          Only the people who asked to be contacted. Their company number and e-mail address appear nowhere else in these pages.
        </p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-normal">Response</th>
                  <th className="py-2 pr-4 font-normal">Link</th>
                  <th className="py-2 pr-4 font-normal">E-mail</th>
                  <th className="py-2 pr-4 font-normal">Open to</th>
                  <th className="py-2 font-normal">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => (
                  <tr key={c.code}>
                    <td className="py-2 pr-4">
                      <a href={withLang(`/admin/results/${c.code}`, lang)} className="font-mono text-accent hover:underline">{c.code}</a>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{c.tag ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {c.email ? <a href={`mailto:${c.email}`} className="text-accent hover:underline">{c.email}</a> : "—"}
                    </td>
                    <td className="py-2 pr-4">{c.openTo.map((o) => t(o.label, lang)).join(", ")}</td>
                    <td className="py-2 tabular-nums">{new Date(c.completedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run all checks**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass; the build lists `/admin/results`, `/admin/results/open`, `/admin/results/contacts` and `/admin/results/[code]` as dynamic (ƒ).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/results/contacts/page.tsx tests/components/ResultsPages.test.tsx
git commit -m "feat: contacts list for people who asked (#31)"
```

---

### Task 8: Documents

**Files:**
- Modify: `AGENTS.md:20-22`
- Modify: `docs/design/2026-09-21-interview-form-design.md` (the `/admin` bullet in §10, around line 352)
- Modify: `README.md` (procedure 6, around lines 125–136)

- [ ] **Step 1: AGENTS.md**

Replace

```
  builder. Changing a question means changing that file. One admin page
  (`/admin`, behind `ADMIN_PASSWORD`; 2026-09-24) shows counts and makes
  invitation links — never answer text.
```

with

```
  builder. Changing a question means changing that file. The admin page
  (`/admin`, behind `ADMIN_PASSWORD`; 2026-09-24) shows counts and makes
  invitation links; its results pages (`/admin/results`, 2026-09-28, #31)
  show the answers by reference code. The company number and e-mail
  address appear only on their Contacts page, for people who asked to be
  contacted.
```

- [ ] **Step 2: Design doc §10**

Replace

```
  is `noindex` and `no-store`, and shows counts only — no answer text, no
  company number. The one admin route, `/api/admin/tags`, returns tags and
  times for company-reach and nothing else.
```

with

```
  is `noindex` and `no-store`, and shows counts. Its results pages
  (`/admin/results`, 2026-09-28, #31; `2026-09-28-results-dashboard.md`)
  show the answers by reference code; the company number and the e-mail
  address appear only on their Contacts page, for the people who asked to
  be contacted, and that page is not printed. The one admin route,
  `/api/admin/tags`, returns tags and times for company-reach and nothing
  else.
```

- [ ] **Step 3: README**

Rename procedure 6 to `**6. Make an invitation link, see the numbers and the results.**`, replace its item 4 with

```
4. The same page shows how many responses are completed, in progress, and
   from which kind of link, and links to **Read the results**
   (`/admin/results`): each question with its counts, the open answers with
   the AI's follow-ups and reasons, each response by reference code, and the
   contacts of the people who asked to be contacted. `?l=de` shows the
   questions in German. To give the supervisors a copy, print a page to PDF
   (the tabs and the contacts are left out).
```

- [ ] **Step 4: Check and commit**

Run: `grep -n "never answer text" AGENTS.md docs/design/2026-09-21-interview-form-design.md README.md`
Expected: no output.

```bash
git add AGENTS.md docs/design/2026-09-21-interview-form-design.md README.md
git commit -m "docs: the admin pages now show results (#31)"
```

---

### After the tasks

- Open the PR: title `Results pages on /admin (#31)`, body with `Closes #31` and `Closes #25`.
- After merge and deploy: open `https://firmenumfrage-ostschweiz.vercel.app/admin/results` with the admin password; check all four tabs, `?l=de`, and the print preview of the Overview and Open answers pages.
