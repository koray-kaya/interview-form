// The prompt evals: the only tests that call a real model. They are opt-in
// (RUN_LLM_EVALS=1) and cost money, so `npm test` never runs them.
//
//   RUN_LLM_EVALS=1 npm run evals
//   RUN_LLM_EVALS=1 PROBE_REASONING=low npm run evals
//
// Each fixture is judged twice, because the same answer can be decided
// differently from one call to the next and a prompt that only sometimes
// holds is not a rule.
//
// Every trial is written to data/evals/ (gitignored): the decision, how long
// it took, and the question the model wrote. The numbers say whether the
// prompt works; only reading the questions says whether it works for the
// right reason, and that is Koray's job, not an assertion's.
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FORM, type OpenQuestion } from "@/form";
import { t } from "@/i18n";
import { DEADLINE_MS as DEFAULT_DEADLINE_MS, DEFAULT_REASONING, runProbe, type ProbeResult, type Reasoning } from "@/probe";
import { FIXTURES, type Fixture } from "./fixtures";

const TRIALS = 2;
const REASONING = (process.env.PROBE_REASONING as Reasoning) || DEFAULT_REASONING;
// Raise it to see the real tail: at the production deadline every slow call is
// cut off at the limit, so the measurement cannot say how slow slow really is.
const DEADLINE_MS = Number(process.env.PROBE_DEADLINE_MS) || DEFAULT_DEADLINE_MS;

const enabled = process.env.RUN_LLM_EVALS === "1";
const keyed = Boolean(process.env.AI_GATEWAY_API_KEY);

type Trial = { fixture: Fixture; trial: number; result: ProbeResult };
const trials: Trial[] = [];

const question = (id: Fixture["question"]) => FORM.questions.find((q) => q.id === id) as OpenQuestion;

function transcriptFor(fixture: Fixture) {
  const asked = t(question(fixture.question).text, fixture.lang);
  const turns = [{ question: asked, answer: fixture.answer }];
  return fixture.earlier ? [...turns, fixture.earlier] : turns;
}

function contextFor(fixture: Fixture) {
  if (!fixture.context) return undefined;
  return [{ question: t(question("case").text, fixture.lang), answer: fixture.context }];
}

const outcome = (result: ProbeResult) =>
  result.decision === "error" ? `error/${result.errorClass}` : result.decision;

/** Everything one run measured, as a page to read rather than a number to quote. */
function writeReport(): void {
  if (trials.length === 0) return;
  const asked = trials.filter((row) => row.result.decision === "ask");
  const lengths = asked.map((row) => row.result.followUp?.length ?? 0);
  const latencies = trials.map((row) => row.result.latencyMs).sort((a, b) => a - b);
  const at = (values: number[], share: number) => values[Math.min(values.length - 1, Math.floor(values.length * share))];
  const mean = (values: number[]) =>
    values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  const counted = new Map<string, number>();
  for (const row of trials) counted.set(outcome(row.result), (counted.get(outcome(row.result)) ?? 0) + 1);

  const right = trials.filter((row) => row.result.decision === row.fixture.expect).length;

  const summary = [
    `# Probe evals — reasoning: ${REASONING}`,
    "",
    `Run at ${new Date().toISOString()} · ${FIXTURES.length} fixtures × ${TRIALS} trials · deadline ${DEADLINE_MS} ms`,
    "",
    "| measure | value |",
    "|---|---|",
    `| trials deciding as the criterion demands | ${right} / ${trials.length} |`,
    ...[...counted.entries()].sort().map(([name, count]) => `| ${name} | ${count} |`),
    `| median latency | ${at(latencies, 0.5)} ms |`,
    `| 75th percentile | ${at(latencies, 0.75)} ms |`,
    `| 90th percentile | ${at(latencies, 0.9)} ms |`,
    `| slowest | ${latencies[latencies.length - 1]} ms |`,
    ...[6, 8, 10, 12, 15].map(
      (seconds) => `| calls that would miss a ${seconds} s deadline | ${latencies.filter((ms) => ms >= seconds * 1_000).length} |`,
    ),
    `| mean follow-up length | ${mean(lengths)} characters |`,
    "",
    "## Every question the model wrote",
    "",
  ];

  const body = trials.map((row) => {
    const head = `**${row.fixture.question} · ${row.fixture.id} (${row.fixture.lang})** — expected ${row.fixture.expect}, trial ${row.trial}`;
    const got = `- ${outcome(row.result)} in ${row.result.latencyMs} ms`;
    const wrote = row.result.followUp ? `- > ${row.result.followUp}` : null;
    const why = row.result.reason ? `- _${row.result.reason}_` : null;
    return [head, got, wrote, why].filter(Boolean).join("\n");
  });

  const directory = join(process.cwd(), "data", "evals");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}-${REASONING}-${DEADLINE_MS}ms.md`);
  writeFileSync(file, `${[...summary, ...body].join("\n\n")}\n`, "utf8");
  console.log(`\n  report: ${file}\n`);
}

describe.skipIf(!enabled)("probe prompts against the golden answers", () => {
  afterAll(writeReport);

  it("has a gateway key", () => {
    expect(keyed, "AI_GATEWAY_API_KEY is missing from .env.local").toBe(true);
  });

  for (const fixture of FIXTURES) {
    it(
      `${fixture.question} · ${fixture.id} (${fixture.lang}) → ${fixture.expect}`,
      async () => {
        const results: ProbeResult[] = [];
        for (let trial = 1; trial <= TRIALS; trial += 1) {
          const result = await runProbe(
            {
              question: question(fixture.question),
              lang: fixture.lang,
              transcript: transcriptFor(fixture),
              context: contextFor(fixture),
            },
            { reasoning: REASONING, timeoutMs: DEADLINE_MS },
          );
          results.push(result);
          trials.push({ fixture, trial, result });
        }

        // the decision must hold in both trials, not on average
        for (const result of results) {
          expect(result.decision, `${fixture.id}: ${fixture.why}`).toBe(fixture.expect);
        }

        // a follow-up may never put a product in the participant's mouth
        for (const named of fixture.forbidden ?? []) {
          for (const result of results) {
            expect(result.followUp?.toLowerCase() ?? "").not.toContain(named.toLowerCase());
          }
        }
      },
      120_000,
    );
  }
});
