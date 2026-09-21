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

Designed and audited; not built yet. Five milestones — skeleton and form
engine, storage, the AI follow-up, deployment, pilot. Each milestone is
written with an AI coding assistant and explained to me before I review and
merge it, so I learn how it works.

## Run it

Not runnable yet. From milestone 1:

```bash
git clone https://github.com/koray-kaya/interview-form.git
cd interview-form
npm install
npm run dev          # http://localhost:3000 (German; ?l=en for English)
npm test             # offline, a few seconds
```

## Notes

- Built with Next.js, Tailwind, the AI SDK (via Vercel AI Gateway), Supabase
  and Zod. Deployed on Vercel.
- The design, the audit of the design and the build plan are in
  [docs/](docs/) and [IMPLEMENTATION.md](IMPLEMENTATION.md).
- Operations (export, disable the AI, delete a participant) will be
  documented here at milestone 4.

MIT licence. Koray Kaya, 2026.
