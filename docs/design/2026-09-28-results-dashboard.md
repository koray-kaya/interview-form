# Results pages on /admin

Date: 2026-09-28 (design session, finished 2026-09-29). Status: approved by
Koray section by section; the look was chosen on a throwaway mockup with
invented data. Issue #31, part of #5 (M5, pilot). Fixes #25 on the way.
Changes one written decision: until now the admin page showed counts only,
never answer text (`2026-09-21-interview-form-design.md` §10, AGENTS.md).

## 1. Why

Five responses have come in. The only ways to read them are the JSON and CSV
export and the database itself; neither can be read comfortably, and neither
can be shown to the supervisors. The pilot (M5) also needs a hand review of
every question the AI wrote, with the reason it gave. The results pages are
that reading surface: per question, what was answered and in what share; each
open answer with its follow-ups; each response on its own; and a short list of
the people who asked to be contacted.

## 2. Decisions

- **Where.** In the app, under `/admin/results`, behind the admin password
  (`src/proxy.ts`, matcher `/admin/:path*`, which also sets `noindex` and
  `no-store`). Rendered on every request. A local-only page and a static HTML
  report were considered; the live page won because it can be opened
  anywhere, and the data already passes through the same hosting (the
  functions and the nightly Blob export), so no new party sees it. The risk is
  the password: whoever has it reads the answers. The supervisors get the
  printed PDF, not the password.
- **Which responses.** Completed responses of the current `FORM_VERSION`, the
  smoke test's left out — the rule of the CSV export. Unfinished responses
  appear only in the "In progress" count; they are deleted after seven days
  and would make the numbers move.
- **Counting.** Every question shows its n: the completed responses that
  answered it. The skip rules make n differ between questions (a respondent
  who has no case to tell does not see `duration`, `cost`, `result` and
  `gains`). The count comes before the share ("3 / 5 · 60%"): with a small n
  a percentage alone misleads. Options appear in form order, as participants
  saw them, so ordered scales ("1–9 … 250 or more") stay in order. For a
  multiple-choice question the share is of n and the shares add up to more
  than 100%; the card says so.
- **Open answers.** The full text, then the follow-up thread: every model
  decision with its reason (asked, stopped, rejected, error), each follow-up
  and its reply. "The model decided not to ask" and "the model was not
  called" are shown differently. A decision made on an earlier version of the
  answer is marked as such (§5).
- **Company number and e-mail.** Never next to answers. The consent text
  promises that answers are evaluated without company names ("ohne
  Firmennamen ausgewertet") and that the link's company is used only to avoid
  a second invitation and to reach people who wish it. The Contacts page
  serves that second purpose: it lists only the people who chose the
  conversation or the tool trial, with their company number or personal
  code, their e-mail address, what they are open to, and their reference
  code. It is hidden when printing. Everywhere else a response is known only
  by its reference code.
- **Language.** The page chrome is English, like the admin page. Question and
  option texts are English by default; `?l=de` shows them in German, as the
  participants saw them, and the tabs keep the parameter. Free text is shown
  as written.
- **Time.** Every page says when it was read ("As of 28.09.2026 12:52"), so a
  printed copy carries its date.
- **No new dependency.** Bars are plain elements styled with Tailwind and the
  existing theme tokens (`src/app/globals.css`); no chart library.

## 3. Pages

A shared layout holds the title, the "as of" line and the tab bar
(Overview · Open answers · Responses · Contacts). Every page is an async
Server Component that calls `await connection()` first, reads the rows, and
hands them to pure functions; the components below it are synchronous.

| Route | Content |
|---|---|
| `/admin/results` | Tiles (completed, median time, follow-ups asked, model calls), then all fourteen questions in form order under one heading "Questions", numbered 1–14. Closed questions: one horizontal bar per option. The `activities` rows question: one 100% stacked bar per row in five tints of the accent colour, counts inside the segments, one legend, and a "show as a table" fallback. Open questions (4, 8, 9): a card in their place with a summary line ("4 answered · 1 chose "I can't think of such a case." · 3 got an AI follow-up (4 in all)") and a link "Read the 4 answers and the AI follow-ups →" to their section on the Open answers page; the whole card is the link. |
| `/admin/results/open` | One section per open question (anchors `#case`, `#pains`, `#gains`): the question, its counts, then one card per answer: the reference code (a link to the response), the answer, and the thread as a transcript with speaker labels (Answer, AI follow-up 1, Reply 1, …). The AI's turns carry the accent colour and a muted "Why:" line with the model's reason; a stop reads "No further question — <reason>"; the limit reads "No further question — the limit of two follow-ups was reached". |
| `/admin/results/[code]` | One response, by its eight-character reference code: language, minutes taken, number of follow-ups, then the fourteen questions in order with the answers in words; a skipped question reads "skipped (path)" with the rule that skipped it; open answers with their threads; "← previous · next →" in order of completion. A code that is not eight lowercase hex characters, or matches no completed response, gives 404. |
| `/admin/results/contacts` | A table: reference code (link), company number or personal code, e-mail, open to (conversation, trial), completed on. Hidden in print, including its tab. |

The existing `/admin` page keeps its tiles and gets a link to the results.

**Look.** One column the width of the admin page; cards with hairline borders
and no shadows; question numbers in the left margin, n at the top right.
Colour comes only from the theme tokens; the accent (navy) is kept for the
data and for the AI's turns. Bars are a thin accent bar on a pale track that
stands for n, with the count and share at the right.

**Print.** The tab bar and the Contacts page are hidden; A4 margins; no card
is split across pages and no heading is left at the foot of a page; the page
background gradient is dropped; bars still print when the browser leaves out
background graphics.

## 4. Counting rules

For each question, over the completed responses of the current form version
without the smoke test:

- **single:** n = responses with an `{ option }` answer; one count per option.
- **multi:** n = responses with an `{ options }` answer; one count per option;
  shares of n. The e-mail address inside the `followup` answer is dropped here.
- **rows:** n = responses with a `{ rows }` answer; per row, one count per
  scale step.
- **open:** answered = responses with a `{ text }` answer; escaped =
  responses with the escape option; followed up = answers with at least one
  follow-up reply; follow-ups in all = the number of replies.

Tiles: completed count, median minutes from start to completion, follow-ups
asked (`ask` decisions whose follow-up was answered), model calls (all
`probe_calls` rows of the counted responses, with the stops and errors in the
hint).

## 5. The follow-up thread

How calls and answers relate (read from the answers route and `src/db.ts`):
`probe_calls.followup_index` is the number of calls already logged for that
response and question, plus one, whatever their decision; an `ask` is shown
and answered under that same index. Calls are never deleted when an answer
changes, replies cannot be changed once stored, a main answer edited through
Back is overwritten in place, and two calls with the same index can exist
(no unique key; a retry or a second tab can race).

For each completed response and open question q:

1. The main answer is `answers(q, 0)`. Missing: q was skipped. `{ option }`:
   the escape option was chosen. Neither has a thread.
2. For k = 1, 2, the decisions are `probe_calls(q, k)` in order of
   `created_at`. None: "no call" (never shown as a stop). `ask`: the
   follow-up and the reason. `stop` or `rejected`: the reason. `error`: the
   error class. If there are several, all are shown.
3. Reply k is `answers(q, k)`. Its question is `answers.question_text` (what
   the participant saw, and what the CSV exports); the reason comes from the
   `ask` whose `followup_text` equals it.
4. Follow-up 2 does not need a follow-up 1: after a stop, an edited answer can
   earn the second call.
5. A decision older than the main answer's `created_at`, a call 1 followed by
   a call 2 after a non-ask, and a thread whose reply 1 is newer than call 2
   are marked "made on an earlier version of the answer". An edit in place
   after the last call leaves no trace (there is no `updated_at`), so the
   reasons are labelled as given at the time of the call.

## 6. Code

- **Reading (fixes #25).** `src/db.ts` reads every row of the three tables
  in pages of 1000, in a stable order, and checks the total against the exact
  count (`wholeList`), so a short read throws instead of coming back cut off.
  This also fixes the export, the nightly Blob export and the admin counts.
  The rows come back typed.
- **`src/results.ts`** — pure: the counted responses, n and counts per
  question (§4), the tiles, and the ordered answers of one response in words.
  Never returns the company number or the e-mail address.
- **`src/threads.ts`** — pure: the thread of one open answer (§5).
- **`src/contacts.ts`** — pure: the Contacts list. The only module whose
  output holds the company number and the e-mail address.
- **Pages and components** under `src/app/admin/results/` and
  `src/components/results/`: the layout with a small client component for the
  tabs (`useSelectedLayoutSegment`, keeps `?l=`), and synchronous components
  for bars, stacked bars, question cards and threads.

Next.js 16: `params` and `searchParams` are Promises; `notFound()` from
`next/navigation`; `connection()` from `next/server` keeps the pages
per-request (Cache Components is off). A failed read shows the error page,
never a partial page.

## 7. Tests

Test first, offline, fictional companies and codes only (the repository is
public).

- `results`: the response filter (form version, smoke test, unfinished);
  counts and n with the skip rules; multi-choice shares; rows; open
  summaries; tiles; one response in words, with skipped questions.
- `threads`: ask, stop, rejected, error; no call; two follow-ups and the
  limit; follow-up 2 after a stop; a decision on an earlier version; two
  calls with the same index.
- `contacts`: only people who chose the conversation or the trial; "neither"
  is left out.
- Privacy: the rendered Overview, Open answers and response pages contain
  neither the fictional company number nor the fictional e-mail address.
- `db`: more than 1000 rows come back whole; a short page throws.
- Pages, in the pattern of `tests/components/AdminPage.test.tsx`: each page
  renders from mocked rows; an unknown code gives 404; `?l=de` shows German
  texts.

After the deploy: open `/admin/results` in production with the password and
check the print preview.

## 8. Documents that change

- AGENTS.md and `2026-09-21-interview-form-design.md` §10: the admin pages
  show counts, per-question results and each response by its reference code;
  the company number and the e-mail address appear only on the Contacts page
  (2026-09-28).
- The comment at the top of `src/app/admin/page.tsx`.
- README, operations: a step "Read the results and print them".
- The consent text does not change.

## 9. Out of scope

Filters and search, comparisons between groups, translation of free text,
charts for the thesis itself (the analysis runs on the CSV), results of
earlier form versions, and a separate password for the supervisors.
