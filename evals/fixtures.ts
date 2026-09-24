// What the probe prompts are measured against. Every answer here is invented:
// no participant text, no real company, no real person. Each fixture says what
// the model should decide and why, so a failing eval names the rule it broke.
//
// `expect` is the decision the version-2 prompts demand: ask for the primary
// element when it is missing, then for the secondary one. "stop" also
// covers the answers that are findings in themselves — "nothing gets stuck",
// "I don't remember" — where another question would push the person.
// `forbidden` are words a follow-up must never contain: the prompts may not
// name a tool, because the thesis studies which ones people reach for unasked.
import type { Lang } from "@/i18n";

export type Fixture = {
  id: string;
  question: "case" | "pains" | "gains";
  lang: Lang;
  answer: string;
  expect: "ask" | "stop";
  /** What this fixture is testing, in one line. */
  why: string;
  /** The earlier answer about their most recent case (pains and gains). */
  context?: string;
  /** A follow-up already asked and answered on this question. */
  earlier?: { question: string; answer: string };
  forbidden?: string[];
  /** The language the answer is written in, when it is not the form's. The follow-up must be in it. */
  answerLang?: Lang;
};

/** Names a follow-up must not contain when the person fishes for a recommendation. */
const TOOLS = ["LinkedIn", "Google", "Crunchbase", "Moneyhouse", "Zefix", "Bisnode", "ChatGPT", "Bloomberg"];

const CASE_CONTEXT_DE =
  "Wir haben letzten Herbst einen neuen Lieferanten für Verpackungsmaterial geprüft, eine kleine Firma aus der Ostschweiz.";
const CASE_CONTEXT_EN =
  "Last autumn we checked a small packaging supplier before placing a first order with them.";

export const FIXTURES: Fixture[] = [
  // ---- case: the steps taken and the sources used -------------------------
  {
    id: "goal-without-steps",
    question: "case",
    lang: "de",
    answer: "Wir wollten wissen, ob der neue Lieferant zuverlässig ist und ob wir ihm eine grössere Bestellung anvertrauen können.",
    expect: "ask",
    why: "the goal is stated, but no step and no source",
  },
  {
    id: "steps-and-sources",
    question: "case",
    lang: "en",
    answer: "I opened their website, looked them up in the commercial register to see how long they had existed, and then called a colleague who had ordered from them before.",
    expect: "stop",
    why: "three concrete sources, nothing missing",
  },
  {
    id: "verdict-only",
    question: "case",
    lang: "en",
    answer: "They turned out to be fine, so we went ahead with the order.",
    expect: "ask",
    why: "a result, not a way of working",
  },
  {
    id: "the-usual-research",
    question: "case",
    lang: "de",
    answer: "Das Übliche halt, ein bisschen Recherche wie immer.",
    expect: "ask",
    why: "general, names nothing the person actually did",
  },
  {
    id: "one-source-briefly",
    question: "case",
    lang: "de",
    answer: "Ich habe kurz ihre Website angeschaut, mehr nicht.",
    expect: "ask",
    why: "a source, even briefly, is the first element; what they needed to know is absent, so version 2 asks for it",
  },
  {
    id: "does-not-remember",
    question: "case",
    lang: "de",
    answer: "Keine Ahnung mehr, das ist lange her.",
    expect: "stop",
    why: "an answer in itself; asking again would push",
  },
  {
    id: "asks-for-a-tool",
    question: "case",
    lang: "en",
    answer: "Honestly we just guessed. Which tool would you recommend for checking a supplier?",
    expect: "ask",
    why: "no step named, and the question fishes for a recommendation",
    forbidden: TOOLS,
  },
  {
    id: "off-topic",
    question: "case",
    lang: "de",
    answer: "Wir stellen seit 1998 Verpackungen für die Lebensmittelbranche her.",
    expect: "ask",
    why: "answers a different question; no step, no source",
  },
  {
    id: "steps-after-a-follow-up",
    question: "case",
    lang: "en",
    answer: "We needed to know whether they could deliver on time.",
    earlier: { question: "Where did you look, or who did you ask?", answer: "Their website, and I phoned their office." },
    expect: "stop",
    why: "the earlier follow-up already produced the sources; a second would be pushing",
  },
  {
    id: "sources-in-passing",
    question: "case",
    lang: "de",
    answer: "Wir wollten wissen, wem die Firma gehört. Am Ende hat der Handelsregisterauszug gereicht.",
    expect: "stop",
    why: "the source is named in passing and the need is stated: nothing missing",
  },
  {
    id: "discovery-with-sources",
    question: "case",
    lang: "de",
    answer: "Wir suchten neue Kunden im Maschinenbau in der Ostschweiz. Ich bin die Ausstellerliste der letzten Fachmesse durchgegangen, habe die Websites von etwa zwanzig Firmen angeschaut und beim Branchenverband nach Ansprechpersonen gefragt.",
    expect: "stop",
    why: "a search for companies not yet known, with concrete sources and the need named",
  },
  {
    id: "discovery-without-steps",
    question: "case",
    lang: "en",
    answer: "We were looking for new customers in our region.",
    expect: "ask",
    why: "a discovery goal, but no step and no source",
  },
  {
    id: "english-answer-german-form",
    question: "case",
    lang: "de",
    answerLang: "en",
    answer: "We had to check a new logistics partner before signing the contract.",
    expect: "ask",
    why: "the goal without a step; written in English on a German form, so the follow-up is in English",
  },
  {
    id: "one-word-source",
    question: "case",
    lang: "de",
    answer: "Google.",
    expect: "ask",
    why: "a source, but not what they needed to know; too short to tell the language, so German, and the name is not repeated",
    forbidden: TOOLS,
  },

  // ---- pains: a concrete example, a situation, not a generality -----------
  {
    id: "general-complaint",
    question: "pains",
    lang: "de",
    answer: "Die Informationen sind überall verstreut und oft veraltet.",
    expect: "ask",
    why: "a complaint in general terms; no situation to analyse",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "a-particular-attempt",
    question: "pains",
    lang: "en",
    answer: "Last month I tried to find out who really owns a supplier in Ticino. The register only showed a holding company, and after an hour I gave up.",
    expect: "stop",
    why: "one particular attempt, with what went wrong",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "nothing-gets-stuck",
    question: "pains",
    lang: "de",
    answer: "Eigentlich läuft das problemlos.",
    expect: "stop",
    why: "a finding; pressing for problems would lead the person",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "always-too-long",
    question: "pains",
    lang: "en",
    answer: "It always takes far longer than it should.",
    expect: "ask",
    why: "general; no occurrence named",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "situation-with-a-company",
    question: "pains",
    lang: "de",
    answer: "Bei einem Zulieferer aus dem Wallis fand ich nirgends eine Telefonnummer, nur ein Kontaktformular, auf das nie jemand geantwortet hat.",
    expect: "ask",
    why: "a concrete situation that stops at the obstacle; what it led to is absent",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "links-back-to-the-case",
    question: "pains",
    lang: "en",
    answer: "In that case exactly: their website said nothing about capacity, so we had to ask twice and waited a week for an answer.",
    expect: "stop",
    why: "a short link back to the case counts as the situation",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "one-word",
    question: "pains",
    lang: "de",
    answer: "Mühsam.",
    expect: "ask",
    why: "no situation at all",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "asks-for-a-tool",
    question: "pains",
    lang: "en",
    answer: "Everything is slow. Is there a service you would suggest we subscribe to?",
    expect: "ask",
    why: "general, and fishes for a recommendation",
    context: CASE_CONTEXT_EN,
    forbidden: TOOLS,
  },
  {
    id: "situation-after-a-follow-up",
    question: "pains",
    lang: "de",
    answer: "Vor allem die Suche nach der richtigen Ansprechperson.",
    earlier: {
      question: "Können Sie eine Situation schildern, in der das passiert ist?",
      answer: "Bei der Verpackungsfirma habe ich drei Wochen lang niemanden erreicht, der zuständig war.",
    },
    expect: "stop",
    why: "the earlier follow-up already produced the situation",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "generality-dressed-as-example",
    question: "pains",
    lang: "en",
    answer: "For example, company websites are usually out of date.",
    expect: "ask",
    why: "says \"for example\" but names no occurrence",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "german-answer-english-form",
    question: "pains",
    lang: "en",
    answerLang: "de",
    answer: "Es dauert einfach immer viel zu lange, bis man etwas Verlässliches findet.",
    expect: "ask",
    why: "a generality; written in German on an English form, so the follow-up is in German",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "off-topic",
    question: "pains",
    lang: "en",
    answer: "We are a family business with twelve employees, founded in 1987.",
    expect: "ask",
    why: "does not answer the question; ask once for a concrete situation",
    context: CASE_CONTEXT_EN,
  },

  // ---- gains: what the result would change -------------------------------
  {
    id: "result-without-consequence",
    question: "gains",
    lang: "de",
    answer: "Ein vollständiges Profil mit Besitzverhältnissen und Bonität.",
    expect: "ask",
    why: "the wish, but not what it would change",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "result-and-consequence",
    question: "gains",
    lang: "en",
    answer: "I would have seen within a day that they were too small for us, and not spent two meetings finding that out.",
    expect: "stop",
    why: "says plainly what would have been different",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "nothing-would-change",
    question: "gains",
    lang: "de",
    answer: "Nichts, es war gut so.",
    expect: "stop",
    why: "a finding in itself",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "a-complete-profile",
    question: "gains",
    lang: "en",
    answer: "One page with everything about the company on it.",
    expect: "ask",
    why: "describes the result only",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "would-have-declined-sooner",
    question: "gains",
    lang: "de",
    answer: "Dann hätten wir schon nach zwei Tagen abgesagt statt nach drei Wochen.",
    expect: "ask",
    why: "the consequence is there, but not what a good result would have contained",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "vague-better",
    question: "gains",
    lang: "de",
    answer: "Einfach besser und schneller.",
    expect: "ask",
    why: "neither a result nor a consequence",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "asks-for-a-tool",
    question: "gains",
    lang: "en",
    answer: "Some kind of dashboard, I suppose. What do other companies use for this?",
    expect: "ask",
    why: "a wish without a consequence, and fishes for a recommendation",
    context: CASE_CONTEXT_EN,
    forbidden: TOOLS,
  },
  {
    id: "consequence-after-a-follow-up",
    question: "gains",
    lang: "en",
    answer: "A reliable picture of how solid they are.",
    earlier: {
      question: "What would you have decided or done differently with such a picture?",
      answer: "We would have asked for a deposit instead of shipping on open account.",
    },
    expect: "stop",
    why: "the earlier follow-up already produced the consequence",
    context: CASE_CONTEXT_EN,
  },
  {
    id: "consequence-for-the-team",
    question: "gains",
    lang: "de",
    answer: "Hätten wir gleich gewusst, ob die Firma pünktlich liefert, hätte mein Einkäufer die Woche nicht mit Telefonieren verbracht, sondern mit den laufenden Bestellungen.",
    expect: "stop",
    why: "a consequence for the company, and the information that would have given it",
    context: CASE_CONTEXT_DE,
  },
  {
    id: "off-topic-praise",
    question: "gains",
    lang: "en",
    answer: "Good luck with your thesis, it sounds like an interesting subject.",
    expect: "ask",
    why: "does not answer the question at all",
    context: CASE_CONTEXT_EN,
  },
];
