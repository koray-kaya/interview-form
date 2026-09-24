# interview-form

A short online form for a master's thesis on how Swiss firms look into
other companies. Fourteen screens, one question per screen, German or English.
Three open questions get up to two AI follow-up questions each, asked only
when the answer leaves out something the question needs, under a rule that is
written down. Answers go to a database in Zurich. Built because Typeform's AI
follow-up cannot be instructed and the thesis has to document the rule that
produced every question.

## Status
**Designed and audited, being built in public.** Design:
`docs/design/2026-09-21-interview-form-design.md`; audit of the design:
`docs/design/audit-2026-09-21.md`. Build order and the learning loop:
`IMPLEMENTATION.md` (milestones M1–M5). Task plans per milestone in
`docs/plans/`.

Decided (2026-09-21), details in the design doc:
- The form is a TypeScript file (`src/form.ts`) with a version; no form
  builder, no admin page. Changing a question means changing that file.
- The link carries the invited company's public register number (`?c=`);
  the participant is never asked who they are. The tag is a label, not
  authentication; it only gates the AI cost.
- AI follow-ups only on the three open questions, at most two each, only
  when the named element is missing. The limit is code (`maxFollowUps` in
  `form.ts`); what the model looks for is in each question's own versioned
  prompt, `prompts/probe-<id>.md`.
- Model through Vercel AI Gateway (OIDC, project budget); Supabase in
  Zurich, written only from the server; Vercel functions pinned to `fra1`.
- Every model decision is logged with tokens, latency and outcome. If the
  model fails, the form continues without a follow-up.

## How we build
- Step by step: the code is written with an AI assistant and explained
  milestone by milestone (which library, why, how it is used, which language
  convention is in play); a human reviews every change before it merges.
  Prefer the plain, readable solution over the clever one.
- Use the standard library for a job: Next.js for pages and route handlers,
  AI SDK for model calls, supabase-js for the database, Zod for schemas,
  Vitest and Playwright for tests. Keep *our own* code plain.
- Test first. Everything deterministic runs offline. Model calls are tested
  by the prompt evals, opt-in (`RUN_LLM_EVALS=1`).
- All files in English, with one exception: `docs/milestones/` is written in
  Turkish and kept out of git — those pages explain a finished milestone to
  the repository's owner and have no other reader.

## Hard rules
- **This repository is public.** Participant data only under `data/`
  (gitignored). Free-text answers can name people; never in git, never in
  examples; eval fixtures use fictional companies.
- Secrets only in `.env.local` and Vercel environment variables (gitignored).
- Nothing a participant sees names a product or shows a logo.
- The consent text promises only what the tiers deliver. Do not add claims.
- main via short-lived branch → PR → review → merge.
- Per-developer notes go in `CLAUDE.local.md` (gitignored).

## Process
- Tracking: GitHub Issues and milestones M1–M5.
- Commits: conventional, English, <=60-char subject.

## Map
`IMPLEMENTATION.md` milestones and the explain loop · `docs/design/` design
and audit · `docs/plans/` task plans per milestone · `prompts/` the probe
prompt · `src/form.ts` the form · `src/engine.ts` the pure form engine ·
`supabase/migrations/` schema · `data/` and `docs/milestones/` local only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
