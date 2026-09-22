# Should the server side move to FastAPI?

2026-09-22 · short evaluation, written before M1 starts.

**Recommendation: no, not for this project.** Keep the Next.js route handlers
from the design (§4, §8). Revisit only under the conditions at the end.

## What FastAPI would replace

The server side is five small routes (design §8): create a response, read it
for resume, save an answer (and call the probe), complete, and the daily
cron. FastAPI would take over exactly these. The page itself stays Next.js
either way, so FastAPI adds a second stack; it does not replace one.

## What it would cost

- **The form definition would exist twice.** `src/form.ts` and
  `src/engine.ts` run in the browser (screen order, skip rule) and on the
  server (validation, `question_text` stored with every answer). With a Python
  server, both need a Python copy. Two copies drift, and a drifted copy stores
  a question text the participant never saw. That breaks what the thesis has
  to claim about its data.
- **Schemas twice.** Zod on the client, Pydantic on the server, kept in sync
  by hand.
- **Two deployments or two runtimes.** Either a second host (with CORS,
  a second domain and the `Sec-Fetch-Site: same-origin` check redesigned) or
  Vercel Python functions next to the Next.js app (one project, but two
  build toolchains, two test runners, two lint setups).
- **The model call.** The AI SDK (`generateText` + `Output.object`, AI
  Gateway via OIDC) is TypeScript. In Python the probe would use the
  Anthropic SDK or the gateway's OpenAI-compatible endpoint, with OIDC and
  structured output wired by hand.
- **Milestones.** M2 and M3 grow by roughly a third; M4 gains a second
  deploy target.

## What it would bring

- Python is the language Koray reads most easily today (company-reach).
- Pydantic and FastAPI are the patterns of the thesis pipeline, so the
  practice would transfer.
- Nothing in this project's function needs it: no LangGraph, no Python-only
  library, one model call per answer, no tools, no memory.

## When to reconsider

- The probe grows from one decision into a multi-step agent that wants
  LangGraph.
- The form has to reuse code that only exists in Python (e.g. from the
  thesis pipeline or company-reach).
- The server side has to run somewhere other than Vercel.

None of these holds on 2026-09-22.

## Cheaper ways to get the learning value

- Read the route handlers side by side with a FastAPI version of one route
  (not deployed), written as an exercise in `docs/milestones/`.
- Zod ↔ Pydantic is a near one-to-one mapping; the M2 explanation page can
  show both.
