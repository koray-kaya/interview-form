# M4 — Deploy and harden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Code tasks (1–5) are built test first and end green (`npm test`, `npm run lint`, `npx tsc --noEmit`) with one conventional commit each. Operations tasks (6–9) change Koray's Vercel and Supabase accounts: each step that creates, changes or spends something runs only on Koray's go, and each is verified by reading the resulting state back.

**Goal:** The form runs in production on Vercel in Frankfurt, its model calls stay in the EU, abuse and spend are capped, a smoke test proves the whole path after every production deploy, and a runbook covers the six things that can go wrong or need doing (issue #4; closes #7 on the way).

**Architecture:** GitHub stays the source of truth: the Vercel project is connected to `koray-kaya/interview-form`, so a merge to `main` deploys to production and a PR gets a protected preview. Functions run in `fra1`, the database stays in Zurich, and every model call is pinned to the EU through the AI Gateway's `inferenceRegion` (served by AWS Bedrock in `eu-central-1`, Frankfurt) and never used for training; the resolved region is logged per call. A Playwright smoke test walks the short path with the reserved tag `?c=SMOKE`, which never reaches the model and is removed by the daily cron.

**Tech Stack:** Next.js 16 on Vercel (Hobby), AI SDK 7 through AI Gateway (OIDC in production), Supabase (Zurich), Vercel Blob, Vercel Firewall, Playwright, GitHub Actions.

**Spec:** `docs/design/2026-09-21-interview-form-design.md` §10 (security and privacy), §11 (operations), §13 (deployment); `IMPLEMENTATION.md` §3–4 (M4 row and acceptance); issue #4; issue #7 (CI).

## Global Constraints

- Functions in `fra1` (`vercel.json` `regions`), Supabase in Zurich, model inference in the EU (`inferenceRegion: { scope: "zone", geoRegion: "eu" }`); a call that cannot be served in the EU fails, and the form continues without a follow-up.
- Every model call: `disallowPromptTraining: true`. Not `zeroDataRetention`: the Hobby plan refuses it with 403 (measured 2026-09-24); ZDR needs Pro — Koray's decision.
- Production authenticates to the gateway by OIDC; `AI_GATEWAY_API_KEY` exists only in `.env.local`.
- `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` only in Vercel environment variables and `.env.local`; nothing secret in git, in a log line, or in chat.
- Production public but `noindex`; preview deployments behind Vercel Authentication.
- The production URL stays out of the public repository: GitHub secret `PRODUCTION_URL` (masked in Actions logs), `CLAUDE.local.md` (open point 1).
- AI Gateway budget 10 USD/month, alerts at 50 / 75 / 100 %.
- One firewall rate-limit rule: `/api/*`, 120 requests per 10 minutes per IP (raised from 60 on 2026-09-24, see design §10).
- Nothing a participant sees names the form's own processors.
- Commits: conventional, English, subject ≤ 60 characters, ending with the `Co-Authored-By` trailer.

## Findings that shaped this plan (2026-09-24)

| Finding | Evidence | Consequence |
|---|---|---|
| Model calls are **not** in the EU today. Design §10 says "Anthropic EU", but `runProbe` sets no region, and the gateway's default is `global`. | Live catalog: Sonnet 5 via Anthropic direct lists only a `us` zone; via Bedrock it lists `eu` (`eu-central-1`). Docs: "The default (no `inferenceRegion`) is `global` … may be outside your users' jurisdiction." | Task 1 pins every call to the EU and adds ZDR; Task 2 logs the region each call actually ran in. |
| EU inference costs 10 % more. | Catalog `pricing.regional.eu`: Sonnet 5 input 2.2 vs 2.0 USD per million tokens; Haiku 4.5 1.1 vs 1.0. | Negligible at this volume (a few hundred calls); the 10 USD budget stands. |
| The installed gateway provider does not type `inferenceRegion` (4.0.88; latest 4.0.91 neither), but forwards `providerOptions` unchanged in the request body. | `node_modules/@ai-sdk/gateway/dist/index.js`, `getArgs`. | The option works without an upgrade; Task 1 verifies it on a live call and in the logs rather than trusting the type. |
| No Vercel project exists yet; the CLI is outdated (51.2.1) and logged out. | Vercel connector: the team has no projects; `vercel whoami` fails. | Operations go through the Vercel connector and the dashboard; the CLI is not needed. |
| A production smoke test writes a real response. | `POST /api/responses` stores whatever `?c=` carries. | Task 3 reserves `?c=SMOKE`: never probed (not a valid UID), left out of the CSV, deleted by the daily cron. |
| Design §10 still says "the consent text names the processors"; §13 lists an `AI_GATEWAY_MODEL` variable the code does not read. | Form 2.0 decisions (2026-09-23, -24); `src/probe.ts` constants. | Task 5 corrects both sections. |

## Open points (one question each, answered before the task named)

1. **Answered 2026-09-24** (Koray): a neutral German name on `vercel.app` naming the survey and the region; the exact URL is kept out of this public repository (`CLAUDE.local.md`, GitHub secret `PRODUCTION_URL`). Free; names what it is and the region, not the school — OST on a free hosting domain would look like phishing and needs OST's permission; the invitation's sender and the welcome screen carry OST. Other regions later get a second `vercel.app` alias on the same project. Original question: A Vercel project gets `<project-name>.vercel.app`; the name appears in every invitation link, and "vercel" in it names a processor (the rule in `AGENTS.md`). Options: a neutral project name on `vercel.app` (free, e.g. `firmen-umfrage.vercel.app`), or an own domain (about CHF 15 a year, e.g. `firmenumfrage.ch`), or an OST subdomain (asks OST IT; slowest).
2. **Before Task 9: the consent text.** M4's issue says "final consent text", but whether an ethics approval is needed is itself a question for the supervisors (thesis repository, issue #3, agenda of the supervisor meeting). Proposal: M4 ships the current text and the runbook records "consent text final after ethics approval"; no invitation goes out before that.

## Review Focus

1. **The gateway cannot serve the EU for a call** (Bedrock EU down, or the fallback model not available there): the call fails with 400, is logged as `error/provider`, and the form continues without a follow-up — it must never silently run in the US. Test in Task 1.
2. **The gateway response carries no routing metadata** (older gateway, or a failed call): the region column stays empty, the call is still logged. Test in Task 2.
3. **A participant uses `?c=SMOKE` or `?c=smoke`**: treated as the smoke tag only in exact upper case; any other spelling is an ordinary invalid tag. Test in Task 3.
4. **CI without secrets builds the app**: `npm run build` must not need `.env.local`. Checked in Task 4.
5. **The daily cron fails halfway** (Supabase paused, Blob down): the smoke cleanup and the seven-day cleanup run before the export, so a Blob failure does not keep test rows. Test in Task 3.

---

### Task 1: Every model call stays in the EU

**Files:**
- Modify: `src/probe.ts`
- Test: `tests/probe.test.ts`

**Interfaces:**
- Produces: `INFERENCE_REGION` constant; `resolvedRegion(metadata: unknown): string | undefined`; `ProbeResult.region?: string`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/probe.test.ts` (import `resolvedRegion` too):

```ts
describe("where the model runs", () => {
  it("asks the gateway for EU inference, zero data retention and no training", async () => {
    const sent: unknown[] = [];
    await runProbe(input, { model: modelReturning(answered({}), sent) });
    const gateway = (sent[0] as { providerOptions?: { gateway?: Record<string, unknown> } }).providerOptions?.gateway;
    expect(gateway?.inferenceRegion).toEqual({ scope: "zone", geoRegion: "eu" });
    expect(gateway?.zeroDataRetention).toBe(true);
    expect(gateway?.disallowPromptTraining).toBe(true);
  });

  it("reads the region the gateway reports, from the last provider attempt that names one", () => {
    const metadata = {
      gateway: {
        routing: {
          finalProvider: "bedrock",
          modelAttempts: [
            { providerAttempts: [{ provider: "bedrock", inferenceEndpoint: { slug: "geo-eu", scope: "zone", geoRegion: "eu" } }] },
          ],
        },
      },
    };
    expect(resolvedRegion(metadata)).toBe("eu");
  });

  it("reports no region when the gateway says nothing, or routed globally", () => {
    expect(resolvedRegion(undefined)).toBeUndefined();
    expect(resolvedRegion({ gateway: {} })).toBeUndefined();
    expect(resolvedRegion({ gateway: { routing: { modelAttempts: [{ providerAttempts: [{ inferenceEndpoint: null }] }] } } })).toBeUndefined();
  });

  it("keeps the form going when the EU cannot serve the call", async () => {
    const refused = new APICallError({
      message: "no provider can serve the requested region",
      url: "https://ai-gateway.vercel.sh",
      requestBodyValues: {},
      statusCode: 400,
    });
    const result = await runProbe(input, { model: modelThrowing(refused) });
    expect(result.decision).toBe("error");
    expect(result.errorClass).toBe("provider");
  });
});
```

- [ ] **Step 2: Run and watch them fail.** `npx vitest run tests/probe.test.ts` — expected: the options test fails (no `inferenceRegion`), `resolvedRegion` is not exported. The last test may already pass: it pins that a 400 is an error, not a crash.

- [ ] **Step 3: Implement.** In `src/probe.ts`, below `FALLBACK_MODEL`:

```ts
/**
 * Inference stays in the EU (design §10). Both models are served there by AWS
 * Bedrock in Frankfurt; the gateway fails the call rather than run it
 * elsewhere, and the form then continues without a follow-up. Costs 10 % more
 * than global routing (catalog, 2026-09-24).
 */
export const INFERENCE_REGION = { scope: "zone", geoRegion: "eu" } as const;

const RoutingSchema = z.object({
  gateway: z.object({
    routing: z.object({
      modelAttempts: z.array(
        z.object({
          providerAttempts: z
            .array(z.object({ inferenceEndpoint: z.object({ geoRegion: z.string() }).nullable().optional() }))
            .optional(),
        }),
      ),
    }),
  }),
});

/** The region the gateway reports it ran inference in, if it says. */
export function resolvedRegion(metadata: unknown): string | undefined {
  const parsed = RoutingSchema.safeParse(metadata);
  if (!parsed.success) return undefined;
  const regions = parsed.data.gateway.routing.modelAttempts
    .flatMap((attempt) => attempt.providerAttempts ?? [])
    .map((attempt) => attempt.inferenceEndpoint?.geoRegion)
    .filter((region): region is string => region !== undefined);
  return regions.at(-1);
}
```

In `runProbe`, extend `providerOptions.gateway`:

```ts
        gateway: {
          models: [FALLBACK_MODEL],
          disallowPromptTraining: true,
          zeroDataRetention: true,
          inferenceRegion: INFERENCE_REGION,
        },
```

and add to `call`: `region: resolvedRegion(result.providerMetadata),`. Add `region?: string;` to `ProbeResult`.

- [ ] **Step 4: Run everything.** `npm test && npm run lint && npx tsc --noEmit` — green.

- [ ] **Step 5: Verify on the real gateway.** Print `result.region` per trial in the eval report (`evals/probe.eval.ts`, after the latency: `` ` in ${row.result.latencyMs} ms, region ${row.result.region ?? "?"}` ``), then run `RUN_LLM_EVALS=1 npm run evals`. Expected: 72 / 72 as before, every trial `region eu`, latency measured again (Bedrock EU was slower than Anthropic direct in the catalog: p50 3.4 s against 2.1 s). If the median rises above 4 s or any call misses the 12 s deadline, stop and bring the numbers to Koray before Task 2.

- [ ] **Step 6: Commit.** `feat: keep model calls in the EU`

> **Ruling 2026-09-24:** the first live run with `zeroDataRetention: true` failed every call with 403 ("ZDR is only available for Pro and Enterprise plans"). ZDR is dropped; the EU pin stays. Two EU runs: 69/72 and 71/72, 72/72 calls in `eu`, median 2.6–2.7 s; the German-form/English-answer fixture got a German follow-up once per run (never on global routing).

---

### Task 2: Log the region of every call

**Files:**
- Create: `supabase/migrations/20260924000000_probe_inference_region.sql`
- Modify: `src/db.ts` (`ProbeCallRow`), `src/app/api/responses/[id]/answers/route.ts` (`logProbeCall`)
- Test: `tests/api/answers.test.ts`

**Interfaces:**
- Consumes: `ProbeResult.region` (Task 1).
- Produces: column `probe_calls.inference_region text` (null when unknown).

- [ ] **Step 1: Write the failing test.** In the probe `describe` of `tests/api/answers.test.ts`:

```ts
  it("logs the region the call ran in, and null when the gateway did not say", async () => {
    probeable();
    decides({ region: "eu" });
    await answer(caseAnswer);
    expect(db.logProbeCall).toHaveBeenLastCalledWith(expect.objectContaining({ inference_region: "eu" }));
    vi.mocked(db.logProbeCall).mockClear();
    probeable([row("case", { text: "We looked into a new supplier." })]);
    decides({ region: undefined, decision: "error", errorClass: "provider" });
    await answer({ questionId: "case", followupIndex: 0, value: { text: "We looked into a supplier in Ticino." } });
    expect(db.logProbeCall).toHaveBeenLastCalledWith(expect.objectContaining({ inference_region: null }));
  });
```

- [ ] **Step 2: Run and watch it fail.** `npx vitest run tests/api/answers.test.ts`.

- [ ] **Step 3: Implement.** Migration:

```sql
-- Where the model ran each call (AI Gateway routing metadata), so the thesis
-- can show that every participant's answer was processed in the EU. Null when
-- the gateway did not report a region (a failed call, or no routing metadata).
alter table public.probe_calls add column inference_region text
  check (inference_region is null or char_length(inference_region) <= 16);
```

`ProbeCallRow` gains `inference_region: string | null;`; `logProbeCall({ …, inference_region: result.region ?? null })`.

- [ ] **Step 4: Run everything**, then **apply the migration on Koray's go**: dry run in a rolled-back transaction, apply with the Supabase connector (`apply_migration`), read the column back from `information_schema.columns`, run the advisors.

- [ ] **Step 5: Commit.** `feat: log the inference region of every model call`

---

### Task 3: The smoke tag

**Files:**
- Modify: `src/db.ts`, `src/app/api/cron/daily/route.ts`, `src/csv.ts`
- Test: `tests/api/cron.test.ts`, `tests/csv.test.ts`

**Interfaces:**
- Produces: `SMOKE_TAG = "SMOKE"` exported from `src/responses.ts`; `deleteSmokeResponses(): Promise<number>` in `db.ts`; cron result `{ deleted, smoke, exported }`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/csv.test.ts`: a completed 2.0.0 response with `company_uid: "SMOKE"` is not in the CSV; one with `"smoke"` is (only the exact tag is reserved).
  - `tests/api/cron.test.ts`: the cron calls `deleteSmokeResponses` and reports `smoke: <n>`; it deletes smoke and unfinished responses **before** the export, so a failing `put` still leaves the database clean (mock `put` to throw, expect the call to reject and both deletes to have been called before it).

- [ ] **Step 2: Run and watch them fail.**

- [ ] **Step 3: Implement.** Put the constant where both the server and the CSV can read it without a database import — `src/responses.ts`:

```ts
/**
 * The company tag the production smoke test uses (?c=SMOKE). Not a valid UID,
 * so it never reaches the model; the daily cron deletes these responses and
 * the analysis CSV leaves them out. Exact upper case only.
 */
export const SMOKE_TAG = "SMOKE";
```

`db.ts`:

```ts
/** Deletes the production smoke test's responses (company tag SMOKE_TAG). */
export async function deleteSmokeResponses(): Promise<number> {
  const rows = must(
    await db().from("responses").delete().eq("company_uid", SMOKE_TAG).select("id"),
    "deleteSmokeResponses",
  );
  return rows.length;
}
```

Cron: `const smoke = await deleteSmokeResponses();` right after `touch()`, before the export; answer `{ deleted, smoke, exported }`. CSV: filter `r.company_uid !== SMOKE_TAG`.

- [ ] **Step 4: Run everything; commit.** `feat: reserve the SMOKE tag for the production smoke test`

---

### Task 4: Playwright smoke test and CI (closes #7)

**Files:**
- Create: `playwright.config.ts`, `e2e/short-path.spec.ts`, `.github/workflows/ci.yml`, `.github/workflows/smoke.yml`
- Modify: `package.json` (`@playwright/test` dev dependency, scripts `smoke`), `.gitignore` (`test-results/`, `playwright-report/`)

- [ ] **Step 1: Install.** `npm i -D @playwright/test` (pin the exact version like the other dependencies), `npx playwright install chromium`.

- [ ] **Step 2: Config.** `playwright.config.ts`: `testDir: "e2e"`, one project (Chromium, a phone viewport: `devices["Pixel 7"]`), `baseURL: process.env.SMOKE_URL ?? "http://localhost:3000"`, `retries: 1`, no web server (the test runs against a deployed URL; locally against `npm run dev`).

- [ ] **Step 3: The spec.** `e2e/short-path.spec.ts` walks the short path in English with `?l=en&c=SMOKE`: consent → Start → Owner → 10–49 → Businesses → the escape → a pains answer → every activity row "Never" → Mostly me → None of these → neither → expects "Thank you" and an eight-character reference code. It also asserts that no request to `/api/responses/*/answers` returned a follow-up (`followUp: null` on every response), which proves the tag did not reach the model.

- [ ] **Step 4: Run it locally** against `npm run dev` (writes one SMOKE row to Zurich; delete it with the SQL in the runbook) — green.

- [ ] **Step 5: CI.** `.github/workflows/ci.yml` on `pull_request` and `push` to `main`: Node 24, `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` — no secrets (Review Focus 4; if the build needs an env value, fix the code, not the workflow). `.github/workflows/smoke.yml` on `deployment_status` when `state == success` and the environment is `Production`, plus `workflow_dispatch`: runs `npm run smoke` with `SMOKE_URL` = the deployment's `target_url`.

- [ ] **Step 6: Commit.** `ci: tests on every PR, smoke test after each deploy`

---

### Task 5: Runbook and document corrections

**Files:**
- Modify: `README.md` (new `## Operations`), `docs/design/2026-09-21-interview-form-design.md` (§10, §13), `.env.example`, `package.json` (`engines`)

- [ ] **Step 1: README § Operations,** six procedures, each a short numbered list with the exact command or dashboard path:
  1. **Export** — `npm run export`; where the daily Blob export lives; how to download it.
  2. **Switch probing off** — set `PROBE_ENABLED` to anything but `true` in the Vercel project, redeploy (minutes); switch on again the same way.
  3. **Delete a participant by reference code** — the SQL (`delete from public.responses where replace(id::text, '-', '') like '<code>%'`), with a count query first.
  4. **Check budget and spend** — AI Gateway → Budgets; what 402 means for participants (the form continues without follow-ups).
  5. **Supabase paused** — how to see it, how to restore, what participants see meanwhile.
  6. **Decommission after submission** — final export; delete the Supabase project, the Blob store and the Vercel project; revoke the gateway budget.
- [ ] **Step 2: Design §10:** "model endpoints in the EU" becomes "model inference pinned to the EU with `inferenceRegion` (AWS Bedrock, eu-central-1), zero data retention, no training; the region of each call is logged"; the consent bullet follows form 2.0 (processors not named on screen; answered in the ethics file). **§13:** the variable list becomes the one the code reads (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `PROBE_ENABLED`; OIDC for the gateway).
- [ ] **Step 3:** `package.json` `"engines": { "node": "24.x" }` so Vercel and CI run the same Node.
- [ ] **Step 4: Commit.** `docs: operations runbook, design matches the deployment`

---

### Task 6: The Vercel project (operations — Koray's go per step)

**Answer open point 1 first.**

- [ ] **Step 1:** Apply the `probe_inference_region` migration first (dry run, apply, read the column back): `logProbeCall` writes the column, so without it every probed answer would fail to log. Then squash the branch to one commit (the production URL is in two earlier commits), open the PR and merge it on Koray's approval, so production starts from reviewed code. Set the repository secret `PRODUCTION_URL` (`gh secret set PRODUCTION_URL`).
- [ ] **Step 2:** Create the project from the GitHub repository (Vercel connector `create_git_project`, or the dashboard if the Vercel GitHub app lacks access to the repo), name from open point 1, framework Next.js, root `/`, Node 24. Read the project back: `regions` from `vercel.json` shows `fra1`.
- [ ] **Step 3:** Environment variables for **Production** only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `PROBE_ENABLED=true`. Values come from `.env.local` and go straight to the Vercel API; they are never printed. Read back the names (not the values).
- [ ] **Step 4:** Create a private Blob store in `fra1`, connect it to the project (sets `BLOB_READ_WRITE_TOKEN`).
- [ ] **Step 5:** Deployment Protection: previews behind Vercel Authentication, production public.
- [ ] **Step 6:** First production deploy (the merge from Step 1 triggers it, or redeploy). Read the deployment: region `fra1`, build green, cron registered.

### Task 7: Spend and abuse caps (operations — Koray's go)

- [ ] **Step 1:** AI Gateway budget for the project: 10 USD per month, alerts at 50 / 75 / 100 % — dashboard (AI Gateway → Budgets) by Koray, or `vercel ai-gateway budgets set` after `vercel login` on the latest CLI. Read it back.
- [ ] **Step 2:** Firewall rate-limit rule `/api/*`, 60 requests per 10 minutes per IP, action deny with 429 (connector `put_firewall_config` or dashboard). Verify the Hobby limit on rules first; read the rule back. Check that 60 per 10 minutes fits one participant: 14 answers + 6 follow-ups + start + resume + complete ≈ 25 requests.
- [ ] **Step 3:** Try it once: 61 quick requests from one machine to a harmless endpoint (`GET /api/responses/<unknown-uuid>` → 404) — the 61st gets 429.

### Task 8: Production end to end

- [ ] **Step 1:** The smoke workflow ran after the deploy and is green; the cron removed its SMOKE row (or run the cron once by hand with `CRON_SECRET`).
- [ ] **Step 2:** **Koray on his phone** (deferred from M3.5): both paths in both languages with a valid test UID (`?c=CHE-123.456.788`): a thin case answer gets a follow-up in the answer's language; the rows screen fits without horizontal scrolling (note the time on it); the details fold opens; the thank-you screen shows the code.
- [ ] **Step 3:** `probe_calls` of those runs: `select inference_region, count(*) from public.probe_calls group by 1;` shows only `eu`; latency noted.
- [ ] **Step 4:** The six runbook procedures, each tried once (switch probing off and on; delete one test response by code; export; read the budget; decommission read through, not executed).
- [ ] **Step 5:** Delete every test response from Zurich on Koray's go (count first, delete, count again).

### Task 9: Explain and hand over

- [ ] **Step 1:** `docs/milestones/m4-deploy-and-harden.md` in Turkish: where everything runs and why, the EU finding, the smoke tag, the runbook, what each cap does.
- [ ] **Step 2:** `CLAUDE.local.md` "Start here" → M5 (pilot), with the production URL and the open ethics gate.
- [ ] **Step 3:** Close #4 and #7 with the evidence (deployment region, smoke run, budget, rule).

## Acceptance (IMPLEMENTATION §4, M4)

- The deployment summary shows `fra1`; every model call of the test runs logged `inference_region = eu`.
- The firewall rule and the budget exist and were read back; the rule was triggered once.
- The smoke test passes against production with probing disabled (the SMOKE tag), in CI after the deploy.
- The runbook's procedures were each tried once.
- The form works end to end on Koray's phone in both languages.
