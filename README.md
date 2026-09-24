# interview-form

A small tool I am building for my master's thesis. I need people at
Swiss companies to tell me how they look into other companies today — a
possible customer, a supplier, a competitor — and what that costs them. This
is the form they fill in.

## What it does

1. Shows fourteen questions, one per screen, in German or English. About ten
   minutes: three to write, the rest to tap.
2. On the three open questions, asks up to two short follow-up questions —
   but only when the answer leaves out something the question needs (the
   steps and sources, a concrete situation, what a better result would have
   changed). The rule that decides this is a versioned prompt file, so the
   thesis can print it.
3. Stores the answers in a database in Zurich. Every AI decision is logged
   with its cost and outcome.
4. Never asks who the participant is. The invitation link already carries
   the invited company's public register number.

## Status

Milestones 1 to 3 of 5 are done, and form 2.0 on top of them: the form runs in both languages, stores every
answer in the database in Zurich, and asks the AI follow-up on the same screen
as the question that earned it. Five milestones — skeleton and form engine,
storage, the AI follow-up, deployment, pilot. Each milestone is written with an
AI coding assistant and explained to me before I review and merge it, so I
learn how it works.

## Run it

```bash
git clone https://github.com/koray-kaya/interview-form.git
cd interview-form
npm install
cp .env.example .env.local   # fill in the Supabase URL and secret key
npm run dev          # http://localhost:3000 (German; ?l=en for English)
npm test             # offline, a few seconds
npm run export       # all rows to data/export-YYYY-MM-DD.json, and the analysis
                     # table (one row per completed response) to .csv (gitignored)
```

The AI follow-up is off unless `PROBE_ENABLED=true`; then it runs for every
response except the smoke test's, and the AI Gateway's monthly budget caps
the cost. The prompts are measured against thirty-six invented answers:

```bash
RUN_LLM_EVALS=1 npm run evals   # calls the real model; needs a gateway key
```

They print every question the model wrote to `data/evals/` (gitignored), because
the numbers say whether a prompt works and only the questions say whether it
works for the right reason.

The database schema is in `supabase/migrations/`; apply it to a new Supabase
project before the first run.

```bash
SMOKE_URL=http://localhost:3000 npm run smoke   # the short path in a phone-sized browser
```

The smoke test walks the short path with the reserved company tag `?c=SMOKE`,
which never reaches the model; the daily job deletes those responses and the
analysis CSV leaves them out. CI runs it against production after every
production deployment (the URL is the repository secret `PRODUCTION_URL`).

## Operations

Production runs on Vercel (functions in Frankfurt, `fra1`), the database is a
Supabase project in Zurich, and every model call is pinned to the EU (AWS
Bedrock, Frankfurt) through the AI Gateway; `probe_calls.inference_region`
records where each call ran. A daily job at 03:00 UTC keeps the database
awake, deletes the smoke test's responses and those left unfinished for seven
days, and writes a private JSON export to Vercel Blob.

**1. Export the data.**
1. `npm run export` on a machine with `.env.local`: `data/export-YYYY-MM-DD.json`
   (every row, plus the form) and `.csv` (one row per completed response).
2. The daily exports are in Vercel → the project → Storage → the Blob store,
   `exports/YYYY-MM-DD.json` (private; download from the dashboard).

**2. Switch the AI follow-ups off (and on).**
1. Vercel → the project → Settings → Environment Variables → `PROBE_ENABLED`:
   set it to `false` for Production.
2. Deployments → the current production deployment → Redeploy. Takes a few
   minutes; the form keeps working and simply asks no follow-ups.
   Wait a minute after the redeploy before testing: for a few seconds
   requests can still reach the previous deployment (seen on 2026-09-24).
3. Switch on again the same way with `true`.

**3. Delete a participant by reference code** (the eight characters on their
thank-you screen are the start of the response id).
1. Supabase → SQL editor, find it (the code must be all eight characters):
   `select id, created_at from public.responses where id::text like lower('<code>') || '%';`
2. Exactly one row: delete it by that row's full id, never by the pattern —
   `delete from public.responses where id = '<full id from step 1>';`
   (answers and model calls go with it).
3. Daily exports taken before today still hold the answers: delete those files
   in the Blob store; the next night's export is clean. Delete any local
   `data/export-*` files taken before the deletion too.

**4. Check the budget and the spend.**
1. `vercel ai-gateway budgets list` (or Vercel → AI Gateway → Budgets): the
   project's monthly limit (10 USD) and what is spent. The alerts at 50, 75
   and 100 % are set in the dashboard; the CLI has no option for them.
2. When the budget is used up the gateway answers 402; `probe_calls` logs
   `error_class = budget`, and participants get the form without follow-ups.

**5. Supabase is paused.** Free projects pause after about a week without
activity; the daily job's read is meant to prevent that.
1. Symptom: the welcome screen says the survey could not be started, and
   Vercel's function logs show failed database calls.
2. Supabase → the project → Restore. Takes a few minutes; nothing is lost.
3. If it happens during fieldwork, move the project to the Pro plan for the
   fieldwork window.

**6. Make an invitation link, see the numbers.**
1. Open `/admin` on the production URL; the browser asks for a password (any
   user name, the password is the `ADMIN_PASSWORD` environment variable).
2. Paste a company number (UID) and press Create links, or press Personal
   link for someone without one; copy the German or English link. Note who
   gets a personal code: the answers carry the code, not a name.
3. The same page shows how many responses are completed, in progress, and
   from which kind of link. It never shows answer text.

**7. Decommission after the thesis is submitted.**
1. Final export (procedure 1), stored where the supervisors (or an ethics
   approval, if one is needed) say.
2. Delete the Blob store, the Supabase project and the Vercel project; remove
   the AI Gateway budget.
3. Set this repository to archived.

## Notes

- Built with Next.js, Tailwind, the AI SDK (via Vercel AI Gateway), Supabase
  and Zod. Deployed on Vercel.
- The design, the audit of the design and the build plan are in
  [docs/](docs/) and [IMPLEMENTATION.md](IMPLEMENTATION.md).

MIT licence. Koray Kaya, 2026.
