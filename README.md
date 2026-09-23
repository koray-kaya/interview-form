# interview-form

A small tool I am building for my master's thesis. I need people at
Swiss companies to tell me how they look into other companies today — a
possible customer, a supplier, a competitor — and what that costs them. This
is the form they fill in.

## What it does

1. Shows eight questions, one per screen, in German or English. About six
   minutes.
2. On the three open questions, asks up to two short follow-up questions —
   but only when the answer leaves out something the question needs (the
   steps taken, a concrete example, why it matters). The rule that decides
   this is a versioned prompt file, so the thesis can print it.
3. Stores the answers in a database in Zurich. Every AI decision is logged
   with its cost and outcome.
4. Never asks who the participant is. The invitation link already carries
   the invited company's public register number.

## Status

Milestones 1 to 3 of 5 are done: the form runs in both languages, stores every
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
npm run export       # all rows to data/export-YYYY-MM-DD.json (gitignored)
```

The AI follow-up is off unless `PROBE_ENABLED=true`, and it only runs for a
link whose `?c=` is a well-formed Swiss company number — that gate is what
keeps the cost down. The prompts are measured against thirty invented answers:

```bash
RUN_LLM_EVALS=1 npm run evals   # calls the real model; needs a gateway key
```

They print every question the model wrote to `data/evals/` (gitignored), because
the numbers say whether a prompt works and only the questions say whether it
works for the right reason.

The database schema is in `supabase/migrations/`; apply it to a new Supabase
project before the first run.

## Notes

- Built with Next.js, Tailwind, the AI SDK (via Vercel AI Gateway), Supabase
  and Zod. Deployed on Vercel.
- The design, the audit of the design and the build plan are in
  [docs/](docs/) and [IMPLEMENTATION.md](IMPLEMENTATION.md).
- Operations (export, disable the AI, delete a participant) will be
  documented here at milestone 4.

MIT licence. Koray Kaya, 2026.
