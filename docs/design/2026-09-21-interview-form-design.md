# interview-form — system design

Date: 2026-09-21, revision 1 (after the design audit `audit-2026-09-21.md`).
Status: approved by Koray section by section in the design session; audit
findings P1–P2 worked in. How it gets built: `../../IMPLEMENTATION.md`.

## 1. What it does

A short online form for a master's thesis on how Swiss firms look into
other companies — a possible customer, a supplier, a competitor. Eight
screens, one question per screen, in German or English. Three open questions
may receive up to two AI-generated follow-up questions each, asked only when
the answer leaves out something the question needs. Answers are stored in a
database in Zurich. The form is reached through an invitation link that
carries the invited company's public register number, so the participant is
never asked who they are.

It is not a form builder. The form is a TypeScript file. Changing a question
means changing that file and bumping its version.

Why build instead of using Typeform: Typeform's AI follow-up ("Clarify with
AI") cannot be instructed by the author, always asks two questions, and in a
test followed the respondent's last phrase away from the topic. The thesis
needs follow-ups that ask for what is *missing* against a stated criterion,
and it needs the rule that produced every question to be written down.

## 2. Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Method | Self-completed form; optional follow-up conversation offered at the end | Supervisors are asked whether a form satisfies "interviews"; the form keeps both options open |
| Length | 8 screens, 3 open questions, ≈ 6 minutes | Completion drops sharply past three open questions; small-business owners are the most time-sensitive respondents |
| Identity | Not asked; the link carries `?c=<UID>` | B2B respondents refuse company name and title; the register already holds activity and website |
| AI follow-ups | Only on the three open questions; up to 2 per question; only when the named element is missing | The point of the tool; the limit is code, the criterion is data |
| Model access | Vercel AI Gateway, OIDC from the deployment | No key to manage, project budget caps spend, EU endpoints, catalog says "no training" |
| Model | `anthropic/claude-sonnet-5`, fallback `anthropic/claude-haiku-4.5` | Quality first; ≈ 0.003 USD per call either way |
| Storage | Supabase Postgres, region `eu-central-2` (Zurich), one project for development and fieldwork, writes only from the server with the secret key (`service_role`) | Swiss data stays in Switzerland; the browser never holds a database credential; test rows are wiped before fieldwork |
| Hosting | Vercel Hobby, single function region `fra1` | Free for non-commercial research; default region is the US and must be changed |
| Backups | Daily cron: keep-alive read + JSON export to Vercel Blob; manual export script | Supabase Free pauses after 7 idle days and takes no backups |
| Language | German by default, English as the second option; `?l=en` selects English; toggle on the welcome screen | Target firms are in German-speaking Switzerland; English for the rest |
| Theme | Navy on slate and white (colours of the product mockup), Typeform-style interaction, system font (§6) | Consistent with the project's look; nothing a participant sees names a product |
| Framework | Next.js (App Router, TypeScript), Tailwind, AI SDK, supabase-js, Zod, Vitest, Playwright | Vercel's own stack; one project holds page and server functions |

## 3. The form

Version `1.0.0`. German is the default language and the text most participants
see; English is the second option. Both live in `form.ts`. The German text is
Koray's draft and is checked by a native speaker before the pilot. `Sie`
throughout.

**Welcome + consent (one screen).**

> **How Swiss firms look into other companies**
> I am a master's student in Switzerland. My thesis asks how Swiss firms find
> out about other companies — a possible customer, a supplier, a competitor —
> and what that costs them today. 8 short questions, about 6 minutes. There are
> no right answers; I am interested in how you actually work.
>
> This link is specific to your company. I use that only to avoid inviting you
> twice and to reach you if you ask me to. Results are reported without
> company names. Three of your written answers may receive one or two short
> follow-up questions written by an AI service (Anthropic, via Vercel); those
> answers are not used to train models. Data is stored in Switzerland
> (Supabase, Zurich). You can stop at any time; unfinished answers are deleted.
>
> ☐ I have read this and agree to take part. → **Start**

| # | id | Type | Question (EN) | Frage (DE, draft) |
|---|---|---|---|---|
| 1 | `role` | single choice | Your role — Owner or managing director · Sales · Purchasing · Other | Ihre Rolle — Inhaber/in oder Geschäftsführung · Verkauf · Einkauf · Andere |
| 2 | `size` | single choice | How many people work at your company? — 1–9 · 10–49 · 50–99 · 100–249 · 250 or more | Wie viele Personen arbeiten in Ihrem Unternehmen? — 1–9 · 10–49 · 50–99 · 100–249 · 250 oder mehr |
| 3 | `relations` | multi choice | In the last 12 months, did you look into another company because you needed… — a new customer · a new supplier · to know a competitor · to see where your own company stands · none of these | Haben Sie sich in den letzten 12 Monaten über ein anderes Unternehmen informiert, weil Sie… — einen neuen Kunden suchten · einen neuen Lieferanten suchten · einen Mitbewerber kennen wollten · wissen wollten, wo Ihr eigenes Unternehmen steht · nichts davon |
| 4 | `case` | open, probe ≤ 2 | Think of the most recent case. What did you need to find out, and how did you go about it? | Denken Sie an den letzten Fall. Was mussten Sie herausfinden, und wie sind Sie vorgegangen? |
| 5 | `duration` | single choice | Roughly how long did that take in total? — Under 30 minutes · Up to 2 hours · About half a day · A day or more · Spread over weeks | Wie lange hat das insgesamt etwa gedauert? — Unter 30 Minuten · Bis 2 Stunden · Etwa einen halben Tag · Einen Tag oder mehr · Über Wochen verteilt |
| 6 | `pains` | open, probe ≤ 2 | When you look into other companies, where does it get stuck, take longer than it should, or make you give up? A concrete example helps most. | Wenn Sie sich über andere Unternehmen informieren: Wo hakt es, wo dauert es länger als nötig, wo geben Sie auf? Ein konkretes Beispiel hilft am meisten. |
| 7 | `gains` | open, probe ≤ 2 | Looking back at that case: what would a really good result have looked like, and what would it have changed for you? | Rückblickend auf diesen Fall: Wie hätte ein wirklich gutes Ergebnis ausgesehen, und was hätte es für Sie verändert? |
| 8 | `followup` | multi choice + email | Would you be open to… — a 20-minute conversation · trying a tool in this area later in the project · neither. *E-mail field appears when either is chosen.* | Wären Sie offen für… — ein 20-minütiges Gespräch · einen Test eines Werkzeugs in diesem Bereich später im Projekt · weder noch |

Rules:

- `relations` = "none of these" skips `case` and `duration`. "None of these"
  is exclusive: choosing it clears the other options and vice versa.
- Every open question is required; `followup` is required; e-mail is required
  only when an option other than "neither" is chosen.
- Answers are capped at 4,000 characters.

**Probe criteria** (what the model checks for; the participant never sees
these). Each probed question has its own prompt, `prompts/probe-<id>.md`,
which states the element, when it counts as present, and illustrative
decisions; the prompt files are the source and the thesis prints them.

| Question | Missing element | Context given to the model |
|---|---|---|
| `case` | the steps taken and the sources used | this question's transcript |
| `pains` | a concrete example (a situation, not a generality) | this question's transcript + the `case` transcript |
| `gains` | why the result would matter — what decision or action it would change | this question's transcript + the `case` transcript |

**Thank-you screen.** "Thank you — your answers are saved. Reference code
`ab12cd34`. If you want your answers removed, send this code to
&lt;contact address&gt;." Plus, when a conversation was accepted: "I will be
in touch by e-mail."

## 4. Architecture

```
invitation link  ?c=CHE123456789  (&l=en for English)
      │
      ▼
[browser]  Next.js page, one screen at a time, state in memory,
           response id in localStorage for resume
      │  same-origin fetch, JSON
      ▼
[Vercel function, fra1]  route handlers
      │  service_role (server only)          │  OIDC
      ▼                                       ▼
[Supabase, Zurich]                     [AI Gateway] ─► Anthropic (EU)
 responses · answers · probe_calls      claude-sonnet-5 / haiku-4.5

[Vercel cron, daily] ─► GET /api/cron/daily ─► keep-alive read + JSON export ─► Vercel Blob
```

Deterministic: screen order, skip rule, validation, follow-up limit, post-
check on generated text, storage. Model-directed: one decision per open
answer — is the named element missing, and if so, what one question asks for
it. No tools, no memory, no planning. If the model call fails for any reason
the participant sees no follow-up and the form continues.

Invariant: model calls per question ≤ `maxFollowUps` (2). The limit is
checked before the call; a `stop` decision consumes a call.

## 5. Form definition (`src/form.ts`)

```ts
export const FORM_VERSION = "1.0.0";

type Lang = "de" | "en";
type Text = Record<Lang, string>;

type Question =
  | { id: string; type: "single"; text: Text; options: { id: string; label: Text }[]; required: true }
  | { id: string; type: "multi";  text: Text; options: { id: string; label: Text }[]; required: true;
      email?: { unlessOption: string; label: Text } }
  | { id: string; type: "open";   text: Text; required: true; maxChars: 4000;
      probe?: { maxFollowUps: 2; missing: Text; context?: string[] } };

export const FORM: { version: string; questions: Question[]; skips: Skip[] } = …;
```

`skips`: `{ when: { question: "relations", is: "none" }, skip: ["case", "duration"] }`.

The engine (`src/engine.ts`) is pure: `nextScreen(form, answers)` returns the
next unanswered screen honouring skips, `validate(question, value)` returns
errors, `canProbe(question, followUpsSoFar)` returns a boolean. All of it
runs without the network and is unit-tested.

## 6. Screens and interface

One question per screen, like Typeform: question in large type, helper line
in muted grey, the input, an **OK** button, `Enter` submits (`Shift+Enter` for
a new line in text areas; on a touch screen, which has no Shift key, `Enter`
is a new line and OK submits), key hints `A B C` on choices (ignored while
Cmd, Ctrl or Alt is held), a thin progress bar
at the top, up/down arrows bottom right, language toggle top right on the
welcome screen and, quieter, on the question screens — someone who began in
the wrong language would otherwise have to abandon the form (decided
2026-09-23, issue #9). Follow-up questions appear on the same screen below the answer,
with the answer shown read-only above; while the model is called, a small
"one moment" indicator shows for at most 12 seconds.

Mobile first. Visible focus ring, labelled inputs, `prefers-reduced-motion`
honoured. `<meta name="robots" content="noindex">`.

Theme tokens (CSS variables, updated 2026-09-22). Colours follow the product
mockup: one navy on slate and white. The interaction follows Typeform.

| Token | Value |
|---|---|
| `--background` | `#ffffff` |
| `--wash` | `#f8fafc` (slate-50; page gradient from the top) |
| `--foreground` | `#0f172b` (slate-900; question text) |
| `--body` | `#45556c` (slate-600; helper and intro text) |
| `--muted-foreground` | `#62748e` (slate-500; hints) |
| `--border` | `#e2e8f0` (slate-200) |
| `--accent` | `#1c398e` (blue-900; buttons, answers, choices, progress, focus) |
| `--accent-hover` | `#193cb8` (blue-800) |
| `--danger` | `#c70036` (errors only) |
| `--radius` | `.625rem` |

System font, no web font. Open answers are underlined, not boxed: large navy
text on a line that turns solid on focus and grows with the text. A chosen
option fills its key badge, shows a tick and blinks twice. Each screen slides
in from below, or from above after Back (450 ms); the question number sits
beside the question with a small arrow; up/down buttons bottom right.
| font | `ui-sans-serif, system-ui, sans-serif` |

## 7. Data model (Supabase, `supabase/migrations/`)

```sql
create table responses (
  id            uuid primary key default gen_random_uuid(),
  company_uid   text,                      -- from ?c=, stored as given, never validated for identity
  probe_allowed boolean not null default false,  -- true when company_uid is a well-formed UID (check digit)
  lang          text not null check (lang in ('de','en')),
  form_version  text not null,
  consented_at  timestamptz not null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table answers (
  id             uuid primary key default gen_random_uuid(),
  response_id    uuid not null references responses(id) on delete cascade,
  question_id    text not null,
  followup_index smallint not null default 0,   -- 0 = the fixed question, 1..2 = follow-ups
  question_text  text not null,                 -- exactly what the participant saw
  value          jsonb not null,                -- {"text": …} | {"option": …} | {"options": […], "email": …}
  created_at     timestamptz not null default now(),
  unique (response_id, question_id, followup_index)
);

create table probe_calls (
  id             bigint generated always as identity primary key,
  response_id    uuid not null references responses(id) on delete cascade,
  question_id    text not null,
  followup_index smallint not null,             -- the follow-up this call decided about (1 or 2)
  model          text not null,
  prompt_version text not null,
  decision       text not null check (decision in ('ask','stop','error','rejected')),
  reason         text,                          -- the model's one-line reason, for the hand review
  error_class    text,                          -- timeout | budget | rate_limit | schema | provider | postcheck
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  created_at     timestamptz not null default now()
);

alter table responses   enable row level security;
alter table answers     enable row level security;
alter table probe_calls enable row level security;
-- no policies: only service_role, which bypasses RLS, ever reads or writes
```

What is not stored: IP address, user agent, personal name. The e-mail
address exists only inside the `followup` answer when the participant typed
it. Deleting a response cascades to everything.

`company_uid` is a label, not a fact: a forwarded or edited link changes it.
It is used to match responses to invitations during analysis and for nothing
else.

## 8. API

All routes are same-origin route handlers under `src/app/api/`. Every route
rejects requests whose `Sec-Fetch-Site` header is not `same-origin` or
`none`, and any body over 16 kB. The response id is a v4 UUID and acts as the
bearer for that response.

| Route | Body | Returns | Notes |
|---|---|---|---|
| `POST /api/responses` | `{ c?: string, lang, consent: true }` | `{ id, probeAllowed }` | `probe_allowed` = UID well-formed with valid check digit |
| `GET /api/responses/:id` | — | `{ lang, formVersion, answered: [{questionId, followupIndex, questionText, value}], completed }` | for resume |
| `POST /api/responses/:id/answers` | `{ questionId, followupIndex, value, lang? }` | `{ followUp: { index, text } \| null }` | upsert on the unique key; refuses if not consented or completed; validates against the form; calls the probe when allowed. `lang` is the language on screen when the answer was given: the stored question text is taken from the form in that language, and a change is written to `responses.lang`, which therefore means "last used" |
| `POST /api/responses/:id/complete` | — | `{ referenceCode }` | sets `completed_at`; first 8 hex characters of the id |
| `GET /api/cron/daily` | header `Authorization: Bearer $CRON_SECRET` | `{ exported: n }` | keep-alive read + export; Vercel cron, once a day |

Client retries any `POST` once on network failure; the upsert makes that
safe. A second `POST /api/responses` from the same browser is prevented by
the stored id. A response can be resumed for 7 days; the daily cron deletes
responses with `completed_at is null` older than that, which is the promise
the consent text makes ("unfinished answers are deleted").

**One rule for what an answer set contains** (added 2026-09-22, M1). The
browser and the server call the same pure function, `applyAnswer` in
`src/engine.ts`: it cleans the value (an e-mail address is dropped when the
options chosen do not need one — typed and then opted out of, it is not
kept) and removes the answers to every question the new answer skips. On the
server, `POST /api/responses/:id/answers` loads the fixed answers
(`followup_index = 0`), runs `applyAnswer`, and in one transaction upserts
the new row and deletes every row, at every `followup_index`, of the
questions it pruned. `probe_calls` rows stay: they record what happened.
Submitting an unchanged answer again (walking forward after Back) writes
nothing and never calls the probe. The export reads only answers to active
questions, as a second guard.

## 9. The AI probe (`src/probe.ts`, `prompts/probe-<id>.md`)

**When.** After an answer to a question with `probe`, if
`response.probe_allowed` and `PROBE_ENABLED` and follow-ups so far `<
maxFollowUps`.

**Input.** The question text, the `missing` criterion, the transcript of this
question (fixed answer, then each follow-up question and its answer), the
optional context transcript (`case` for `pains` and `gains`), and `lang`. All
participant text is placed inside delimited data blocks, never in the
instruction part.

**Call.** AI SDK `generateText` with `Output.object` and the schema

```ts
z.object({
  missing: z.boolean(),
  followUp: z.string().nullable(),   // exactly one question in the participant's language, or null
  reason: z.string().max(200),       // one line, for the log
})
```

Built with AI SDK 7, whose names differ from earlier versions: the schema is
passed as `output: Output.object({ schema })`, the prompt file goes in
`instructions` (was `system`), and the deadline is `timeout: { totalMs }`.
The model is named in the code, not in an environment variable
(`PRIMARY_MODEL` in `src/probe.ts`); the fallback comes from
`providerOptions.gateway.models`, and `disallowPromptTraining: true` is set on
every call, which makes the consent sentence "not used to train models" true by
construction — the gateway refuses to route to a provider that may train.
`maxRetries: 1`; one deadline of 12 seconds covers primary and fallback
(8 s until 2026-09-23). No `temperature` (Sonnet 5 does not expose it);
`reasoning: "low"`, chosen by measurement.

**Measured on 2026-09-23** against the thirty eval fixtures, sixty calls with
the eval's own deadline raised to 30 s so that nothing was cut off:

| | `provider-default` | `low` |
|---|---|---|
| completed calls deciding as the criterion demands | 50 / 50 | 60 / 60 |
| follow-ups the post-check had to reject | 0 | 0 |
| median latency | 3 189 ms | 2 338 ms |
| mean follow-up length | 101 characters | 97 characters |

The latency is bimodal: fifty-two calls between 1.5 s and 4.7 s, eight between
8.4 s and 12.6 s, nothing in between. The 12-second deadline therefore slows no
call down; it only changes the outcome for the second group, who at 8 s waited
the longest and got nothing. The two regimes are open as issue #12.

**Rules in the prompts** (the three prompt files are the source; this is the
summary, rewritten 2026-09-22 for Claude Sonnet 5, which follows
instructions literally): each file gives the study's context and what that
question's answer must contain, with when it counts as present and a few
illustrative decisions. One question, in the participant's language, polite
`Sie` and Swiss spelling in German, built on the person's own words, short
enough to read on a phone (the exact length limit is the post-check, not the
prompt). Two constraints carry their reason: no tool, product or service may
be named (the thesis studies which ones people reach for unprompted), and
time and cost are not asked (another question covers them). If the element
is present, `missing = false` and `followUp = null`.

**Post-check (deterministic, after the call).** The follow-up is shown only
if: `missing` is true, `followUp` is non-empty, ≤ 200 characters, contains
exactly one `?` and ends with it, contains no URL and no e-mail address.
Otherwise the decision is logged as `rejected` and nothing is shown.

**Outcomes and logging.** Every call writes one `probe_calls` row: `ask`,
`stop`, `rejected`, or `error` with `error_class`. Tokens and latency come
from the SDK result. Nothing else is logged (Hobby runtime logs live one
hour; the table is the record).

**Cost.** ≈ 1,000 input + 100 output tokens per call ≈ 0.003 USD on Sonnet 5.
Worst case per participant 6 calls ≈ 0.02 USD.

## 10. Security and privacy

- Vercel functions pinned to `fra1` (`vercel.json`), Supabase in Zurich,
  model endpoints in the EU. The path is Frankfurt → Zurich for data,
  Frankfurt → AI Gateway → Anthropic EU for the three probed answers.
- `SUPABASE_SECRET_KEY` exists only in Vercel environment variables and
  `.env.local`; the browser bundle contains no Supabase client.
- Gateway authentication by OIDC; no API key exists.
- RLS enabled on every table with no policies. Table access is an explicit
  `grant` to `service_role` only; `anon` and `authenticated` have none (new
  projects no longer expose `public` tables to the Data API by default).
- The server key is a secret key (`sb_secret_…`); the legacy JWT
  `service_role` key stops working at the end of 2026.
- Probing requires a well-formed UID with a valid check digit (weights
  5 4 3 2 7 6 5 4, mod 11 — ported from company-reach `tools/uid.py`). A
  stripped or forged tag yields the fixed questions only. This is not
  authentication; it is a cost gate.
- One Vercel WAF rate-limit rule (Hobby allows one): `/api/*`, 60 requests per
  10 minutes per IP.
- AI Gateway project budget 10 USD/month with alerts at 50/75/100 %. On 402
  the form continues without follow-ups.
- `PROBE_ENABLED=false` switches probing off; on Vercel this needs a redeploy
  (minutes). That is the kill switch.
- Consent text names the processors and promises only what the tiers
  deliver: "not used to train models" (gateway catalog: `no_training: all`
  for both models, 2026-09-21); no zero-retention claim.
- Withdrawal: the reference code on the thank-you screen; the runbook has the
  delete-by-code step. Retention after the thesis is an open decision for the
  ethics approval.
- Swiss revDSG applies. Nothing a participant sees names a product.

## 11. Reliability and operations

- `GET /api/cron/daily` (Vercel cron `0 3 * * *`, Hobby: once per day) reads
  one row from `responses` — to be verified in the pilot as "activity" that
  prevents the Supabase Free pause across ≥ 8 idle days; if it does not, the
  fallback is Supabase Pro for the fieldwork window — and writes
  `responses`, `answers`, `probe_calls` as one JSON file to Vercel Blob
  (`exports/YYYY-MM-DD.json`).
- `npm run export` writes the same JSON to `data/` locally.
- Latency target: p95 ≤ 6 s from answer submit to follow-up shown; measured
  from `probe_calls.latency_ms` in the pilot.
- Runbook (`README.md` § Operations): export; disable probing; delete a
  participant by reference code; check budget and spend; what to do if
  Supabase is paused; decommission after submission (final export, delete
  Supabase project and Blob store).

## 12. Testing and evaluation

- **Unit (Vitest, offline):** engine (next screen, skips, validation,
  follow-up limit), UID check digit, post-check, form definition sanity
  (every question has both languages, every option has an id).
- **Route tests (Vitest, Supabase mocked):** consent gate, upsert on
  duplicate post, completed response refuses answers, `Sec-Fetch-Site`
  rejection, body size limit.
- **Prompt evals (opt-in, real model, `RUN_LLM_EVALS=1`):** 10–12 fixture
  answers per probed question — detailed (expect `stop`), thin (expect
  `ask`), off-topic, a "which tool would you recommend?" trap (expect no
  recommendation), German and English. Two trials each; the spread is
  reported. Golden fixtures use fictional companies.
- **End to end (Playwright):** one happy path through all eight screens
  against a local dev server with probing disabled.
- **Pilot (M5):** 2–3 people; completion time, follow-up count per
  participant, latency p95, and every generated question reviewed by hand
  against five points — on topic · one question · no tool or solution ·
  participant's language · not leading. The tally decides whether
  `maxFollowUps` stays at 2.

## 13. Deployment

Vercel project (name without any product name; decided at M4), Hobby plan,
`regions: ["fra1"]`, environment variables `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, `AI_GATEWAY_MODEL`, `PROBE_ENABLED`,
`CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`. Preview deployments stay behind
Vercel Authentication; production is public but `noindex`. Locally:
`vercel link && vercel env pull` gives the OIDC token for the gateway.

## 14. Milestones

| # | Milestone | Delivers | Demo |
|---|---|---|---|
| M1 | **Skeleton and form engine** | Next.js project, `form.ts` with all texts, pure engine with tests, the eight screens with the theme, in-memory answers, localStorage resume | `npm run dev` — fill the form in both languages |
| M2 | **Storage** | Supabase schema and migrations, route handlers, upsert, consent gate, resume from server, reference code, export script, daily cron with Blob export | fill the form → rows in Supabase; `npm run export` |
| M3 | **The probe** | `prompts/probe-<id>.md`, `probe.ts` with schema, post-check, timeout, fallback, `probe_calls`, UID gate, kill switch, prompt evals | a thin answer gets a follow-up, a detailed one does not; evals green |
| M4 | **Deploy and harden** | Vercel project in `fra1`, env, budget and alerts, WAF rule, Playwright smoke test, final consent text, runbook | production URL works end to end on a phone |
| M5 | **Pilot** | 2–3 pilot runs, metrics, hand review of every generated question, decision on `maxFollowUps`, pilot report | report attached to the thesis issue |

## 15. Open decisions

- Vercel project name (and therefore the URL). Must not carry a product name.
- Whether the daily cron read counts as activity for Supabase Free (M5
  verifies); otherwise Supabase Pro during fieldwork.
- Retention of raw answers after submission — ethics approval.
- Native-speaker check of the German texts before the pilot.
- HMAC-signed `c` tag (optional, only if misattribution ever matters).
**Settled since.** Editing a probed answer after its follow-ups (2026-09-22,
M3 plan): the limit counts model calls, not follow-ups shown, so the invariant
in §4 holds; earlier follow-up answers stay, each stored with the question text
it answered; an edited answer is judged again only if a call remains. The
language may be changed while answering (2026-09-23, issue #9): it travels with
each answer, so `responses.lang` means "the language last used" and each answer
keeps the wording the person saw.

## 16. Audit trace

| Audit finding | Where it landed |
|---|---|
| Supabase Free pauses; no backups (P1) | §11 cron keep-alive + Blob export; §14 M2 |
| Function region defaults to the US (P1) | §10, §13 `fra1` |
| Duplicate writes on retry (P1) | §7 unique key; §8 upsert |
| No form version on stored data (P1) | §7 `form_version`, `question_text` |
| Consent promises (P1) | §3 consent text; §10 |
| Budget drain (P2) | §10 UID gate, WAF rule, alerts |
| No post-check on generated text (P2) | §9 post-check |
| Retry × timeout (P2) | §9 `maxRetries: 1`, 12-second deadline |
| Context for `pains`/`gains` (P2) | §3 probe criteria table |
| Withdrawal path (P2) | §3 thank-you screen; §11 runbook |
| Runbook (P2) | §11 |
| Error class in `probe_calls` (P2) | §7 |
| Hand-review checklist (P2) | §12 pilot |
| `generateObject` vs `Output.object` | §9 |
