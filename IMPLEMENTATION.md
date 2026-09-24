# Implementation guide

How interview-form gets built, milestone by milestone, and how each milestone
is handed over so the person who owns it learns the system as it grows. The
code is written with an AI assistant (Claude); every milestone is explained
and reviewed by a human before the next one starts. Design:
`docs/design/2026-09-21-interview-form-design.md`.

## 1. The loop

Every milestone runs the same four steps:

1. **Plan.** At the start of the milestone Claude writes a task-level plan to
   `docs/plans/<date>-m<N>-<slug>.md` (small tasks, each with its test), and
   Koray reads it. One question per open point, answered before code.
2. **Build.** Claude writes the code and the tests on a branch, task by task,
   test first. Commits are small and conventional.
3. **Explain.** Claude writes `docs/milestones/m<N>-<slug>.md` — short and
   concrete: what was built, which libraries and why, the three to five
   things worth understanding, where to look in the code, how to run it, and
   what to check. The page is gitignored: it is written for one reader.
   Then walks Koray through it in chat, one topic at a time.
4. **Review.** Koray reads the code with the explanation beside it, runs the
   demo, asks, changes what he wants changed. The PR merges on his approval.

A milestone is done when its demo works and its acceptance criteria pass. No
milestone starts before the previous one is merged.

## 2. Ground rules for the code

- Plain over clever in the code we write: a function Koray can read in one
  screen beats an abstraction. Use the standard library for a job (Next.js,
  AI SDK, supabase-js, Zod) rather than reimplementing it.
- Every module starts with a comment saying what it is for and which library
  it uses, in two or three lines.
- Tests without the network for everything deterministic (Vitest; Supabase
  and the model mocked). Model behaviour is tested by the prompt evals,
  opt-in (`RUN_LLM_EVALS=1`), against fixtures with fictional companies.
- Participant data only under `data/` (gitignored).
- English in files, Turkish in chat — except `docs/milestones/`, which is
  Turkish and gitignored. Conventional commits, ≤ 60 chars.
- TypeScript strict. `npm run lint` and `npm test` pass before every PR.

## 3. Milestones

Five milestones. Each one ends with something Koray can run.

| # | Milestone | Delivers | Demo | Learn |
|---|---|---|---|---|
| M1 | **Skeleton and form engine** | Next.js project, `src/form.ts` with every text in DE and EN, pure `src/engine.ts` with tests, the eight screens with the theme, answers in memory, resume via localStorage | `npm run dev` — fill the form in both languages on a phone-sized window | Next.js App Router · React state and components · TypeScript unions as data · Tailwind + CSS variables · Vitest |
| M2 | **Storage** | Supabase project (Zurich), `supabase/migrations/`, route handlers, upsert on the unique key, consent gate, resume from server, reference code, `npm run export`, daily cron with Blob export and 7-day cleanup | fill the form → rows in Supabase; `npm run export` writes `data/…json`; cron route works locally with the secret | route handlers · service-role vs anon · RLS · migrations · idempotent writes · Vercel cron |
| M3 | **The probe** | `prompts/probe-<id>.md` (one per question), `src/probe.ts` (schema, post-check, deadline, fallback), `probe_calls`, UID check digit, `PROBE_ENABLED`, prompt evals | a thin answer gets a follow-up, a detailed one does not; `RUN_LLM_EVALS=1 npm run evals` green with the spread printed | AI SDK `generateText` + `Output.object` · AI Gateway OIDC · Zod · AbortSignal · what a prompt eval is · reading `probe_calls` |
| M3.5 | **Form 2.0** | fourteen questions (`src/form.ts` 2.0.0), the rows question type, the escape on `case`, two skip rules, the new welcome screen, version-2 probe prompts and their evals | both paths (case told, case escaped) in both languages on a phone | discriminated unions as data · jsonb key order · eval fixtures as a specification |
| M4 | **Deploy and harden** | Vercel project in `fra1`, env vars, budget + alerts, WAF rate-limit rule, `noindex`, Playwright smoke test, final consent text, README § Operations | production URL end to end on a phone; budget visible in the dashboard; smoke test green in CI | `vercel.json` · env and OIDC · WAF · Playwright · a runbook |
| M5 | **Pilot** | 2–3 pilot runs, metrics (time, follow-ups, latency p95), hand review of every generated question, decision on `maxFollowUps`, Supabase pause check across ≥ 8 idle days, pilot report | the report, attached to the thesis issue | reading the data you designed for · deciding from a small sample |

## 4. Acceptance criteria per milestone

- **M1:** every question renders in both languages; skip rule works; `Enter`
  and key hints work; refresh keeps the position; `npm test` green; no
  network call anywhere.
- **M2:** duplicate `POST` yields one row; answering without consent or after
  completion is refused; `question_text` and `form_version` stored;
  reference code shown; export reproduces the analysis table; cron deletes
  a 8-day-old incomplete response in a test.
- **M3:** limit never exceeded (test); post-check rejects a two-question or
  URL-bearing output (test); timeout and 402 leave the form working (test);
  evals: every fixture's expected decision met in both trials, no fixture
  yields a recommendation.
- **M3.5:** every screen renders in both languages; the escape and both skip
  rules work; evals green in both trials with follow-ups in the answer's
  language; the export of a full run reproduces the fourteen answers.
- **M4:** deployment summary shows `fra1`; the WAF rule and the budget exist;
  the smoke test passes against production with probing disabled; the
  runbook's five procedures were each tried once.
- **M5:** report written; `maxFollowUps` decided; Supabase pause behaviour
  known.
