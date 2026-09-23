// The prompt evals: the only tests that call a real model. They are opt-in
// (RUN_LLM_EVALS=1) and cost money, so `npm test` never runs them.
//
//   RUN_LLM_EVALS=1 npm run evals
//
// Each fixture is judged twice, because the same answer can be decided
// differently from one call to the next and a prompt that only sometimes
// holds is not a rule. Every generated question is printed: the numbers say
// whether the prompt works, the questions say whether it works for the right
// reason, and those are the ones Koray reads.
import { describe, expect, it } from "vitest";
import { FORM, type OpenQuestion } from "@/form";
import { t } from "@/i18n";
import { runProbe, type ProbeResult } from "@/probe";
import { FIXTURES, type Fixture } from "./fixtures";

const TRIALS = 2;

const enabled = process.env.RUN_LLM_EVALS === "1";
const keyed = Boolean(process.env.AI_GATEWAY_API_KEY);

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

function report(fixture: Fixture, results: ProbeResult[]): string {
  const lines = results.map((result, trial) => {
    const decided = result.decision === "error" ? `error/${result.errorClass}` : result.decision;
    return `    ${trial + 1}. ${decided}${result.followUp ? ` — "${result.followUp}"` : ""}${result.reason ? `  [${result.reason}]` : ""}`;
  });
  return [`  ${fixture.question} · ${fixture.id} (${fixture.lang}) — expected ${fixture.expect}`, ...lines].join("\n");
}

describe.skipIf(!enabled)("probe prompts against the golden answers", () => {
  it("has a gateway key", () => {
    expect(keyed, "AI_GATEWAY_API_KEY is missing from .env.local").toBe(true);
  });

  for (const fixture of FIXTURES) {
    it(
      `${fixture.question} · ${fixture.id} (${fixture.lang}) → ${fixture.expect}`,
      async () => {
        const results: ProbeResult[] = [];
        for (let trial = 0; trial < TRIALS; trial += 1) {
          results.push(
            await runProbe({
              question: question(fixture.question),
              lang: fixture.lang,
              transcript: transcriptFor(fixture),
              context: contextFor(fixture),
            }),
          );
        }
        console.log(report(fixture, results));

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
