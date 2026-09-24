// The form as data: fourteen questions in German and English, the skip rules,
// and which open questions the AI may probe. Changing a question means
// changing this file and bumping FORM_VERSION. Texts and reasoning:
// docs/design/2026-09-23-form-2.0.md. Plain TypeScript, no library.
import type { Text } from "@/i18n";

export const FORM_VERSION = "2.0.0";

export type Option = { id: string; label: Text };

export type SingleQuestion = {
  id: string;
  type: "single";
  text: Text;
  help?: Text;
  options: Option[];
};

export type MultiQuestion = {
  id: string;
  type: "multi";
  text: Text;
  help?: Text;
  options: Option[];
  /** Choosing one of these clears every other option; choosing another clears these. */
  exclusive?: string[];
  /** Ask for an e-mail address unless only this option is chosen. */
  email?: { unlessOption: string; label: Text };
};

export type OpenQuestion = {
  id: string;
  type: "open";
  text: Text;
  help?: Text;
  maxChars: number;
  /** A one-tap way out ("I can't think of such a case"), stored as { option: escape.id }. Never probed. */
  escape?: Option;
  /** AI follow-ups: at most maxFollowUps model calls; what the model looks for is in prompts/probe-<id>.md. */
  probe?: { maxFollowUps: number; context?: string[] };
};

/**
 * Several statements answered on one shared scale. Each statement is its own
 * row with its own buttons, stacked, not a grid table (design §2). Answered as
 * { rows: { [rowId]: scaleId } }.
 */
export type RowsQuestion = {
  id: string;
  type: "rows";
  text: Text;
  help?: Text;
  rows: Option[];
  scale: Option[];
};

export type Question = SingleQuestion | MultiQuestion | OpenQuestion | RowsQuestion;

/**
 * A skip rule. `is`: the answer contains this option (for rows: some row has
 * it). `every`: the answer has at least one value and all of them are this one.
 * Both must name a question that comes before the ones they skip.
 */
export type Skip = {
  when: { question: string; is: string } | { question: string; every: string };
  skip: string[];
};

export type Form = { version: string; questions: Question[]; skips: Skip[] };

const CHOOSE_ALL = { de: "Mehrfachauswahl möglich.", en: "Choose all that apply." };

export const FORM: Form = {
  version: FORM_VERSION,
  questions: [
    // ---- A: profile ------------------------------------------------------
    {
      id: "role",
      type: "single",
      text: { de: "Ihre Rolle", en: "Your role" },
      options: [
        { id: "owner", label: { de: "Inhaber/in oder Geschäftsführung", en: "Owner or managing director" } },
        { id: "sales", label: { de: "Verkauf", en: "Sales" } },
        { id: "purchasing", label: { de: "Einkauf", en: "Purchasing" } },
        { id: "other", label: { de: "Andere", en: "Other" } },
      ],
    },
    {
      id: "size",
      type: "single",
      text: { de: "Wie viele Personen arbeiten in Ihrer Firma?", en: "How many people work at your company?" },
      options: [
        { id: "1-9", label: { de: "1–9", en: "1–9" } },
        { id: "10-49", label: { de: "10–49", en: "10–49" } },
        { id: "50-99", label: { de: "50–99", en: "50–99" } },
        { id: "100-249", label: { de: "100–249", en: "100–249" } },
        { id: "250+", label: { de: "250 oder mehr", en: "250 or more" } },
      ],
    },
    {
      id: "customers",
      type: "single",
      text: { de: "Wer sind Ihre Kunden hauptsächlich?", en: "Who are your customers, mainly?" },
      options: [
        { id: "businesses", label: { de: "Firmen", en: "Businesses" } },
        { id: "individuals", label: { de: "Privatpersonen", en: "Private individuals" } },
        { id: "both", label: { de: "Beides, etwa gleich viel", en: "Both, about equally" } },
      ],
    },
    // ---- B: the last case ------------------------------------------------
    {
      id: "case",
      type: "open",
      text: {
        de: "Denken Sie an das letzte Mal, als Sie etwas über andere Firmen herausfinden mussten. Was mussten Sie wissen, und wie sind Sie vorgegangen?",
        en: "Think of the last time you needed to find out something about other companies. What did you need to know, and how did you go about it?",
      },
      help: {
        de: "Das kann eine bestimmte Firma gewesen sein oder die Suche nach Firmen, die Sie noch nicht kannten; beides zählt. Beschreiben Sie einfach, was Sie tatsächlich gemacht haben.",
        en: "It may have been one particular company, or a search for companies you didn't know yet; both count. Just describe what you actually did.",
      },
      maxChars: 4000,
      escape: { id: "none", label: { de: "Ich erinnere mich an keinen solchen Fall.", en: "I can't think of such a case." } },
      probe: { maxFollowUps: 2 },
    },
    {
      id: "duration",
      type: "single",
      text: { de: "Wie viel Arbeitszeit hat das insgesamt etwa gekostet?", en: "Roughly how much working time did that take in total?" },
      options: [
        { id: "lt30m", label: { de: "Unter 30 Minuten", en: "Under 30 minutes" } },
        { id: "lt2h", label: { de: "Bis 2 Stunden", en: "Up to 2 hours" } },
        { id: "halfday", label: { de: "Etwa einen halben Tag", en: "About half a day" } },
        { id: "day", label: { de: "Etwa einen Tag", en: "About a day" } },
        { id: "days", label: { de: "Mehrere Tage oder mehr", en: "Several days or more" } },
      ],
    },
    {
      id: "cost",
      type: "multi",
      text: { de: "Hat das etwas gekostet, abgesehen von der Arbeitszeit?", en: "Did it cost anything, apart from working time?" },
      help: CHOOSE_ALL,
      exclusive: ["no", "dont-know"],
      options: [
        { id: "no", label: { de: "Nein", en: "No" } },
        { id: "paid-report", label: { de: "Ein bezahlter Auszug oder Bericht", en: "A paid extract or report" } },
        { id: "subscription", label: { de: "Ein Abo oder eine Datenbank, die wir ohnehin haben", en: "A subscription or database we have anyway" } },
        { id: "outside-help", label: { de: "Externe Hilfe", en: "Outside help" } },
        { id: "dont-know", label: { de: "Weiss ich nicht", en: "I don't know" } },
      ],
    },
    {
      id: "result",
      type: "single",
      text: { de: "Haben Sie am Ende gefunden, was Sie gesucht haben?", en: "In the end, did you find what you were looking for?" },
      options: [
        { id: "yes", label: { de: "Ja, ich hatte, was ich brauchte", en: "Yes, I had what I needed" } },
        { id: "partly", label: { de: "Teilweise, es blieben Lücken", en: "Partly, there were gaps" } },
        { id: "no-went-ahead", label: { de: "Nein, aber ich habe trotzdem entschieden oder weitergemacht", en: "No, but I decided or went ahead anyway" } },
        { id: "no-gave-up", label: { de: "Nein, und ich habe es aufgegeben", en: "No, and I gave up" } },
      ],
    },
    // ---- C: reflection ---------------------------------------------------
    {
      id: "pains",
      type: "open",
      text: {
        de: "Wenn Sie sich über andere Firmen informieren: Wo hakt es, wo dauert es länger als nötig, wo geben Sie auf?",
        en: "When you look into other companies, where does it get stuck, take longer than it should, or make you give up?",
      },
      help: { de: "Ein konkretes Beispiel hilft am meisten.", en: "A concrete example helps most." },
      maxChars: 4000,
      probe: { maxFollowUps: 2, context: ["case"] },
    },
    {
      id: "gains",
      type: "open",
      text: {
        de: "Rückblickend auf diesen Fall: Wie hätte ein wirklich gutes Ergebnis ausgesehen, und was hätte es für Sie verändert?",
        en: "Looking back at that case: what would a really good result have looked like, and what would it have changed for you?",
      },
      maxChars: 4000,
      probe: { maxFollowUps: 2, context: ["case"] },
    },
    // ---- D: the year -----------------------------------------------------
    {
      id: "activities",
      type: "rows",
      text: { de: "Wie oft kam das in den letzten 12 Monaten vor?", en: "How often did this happen in the last 12 months?" },
      rows: [
        { id: "new-customers", label: { de: "Neue Firmen gesucht, die Kunden werden könnten", en: "Looked for new companies that could become customers" } },
        { id: "new-suppliers", label: { de: "Neue Firmen gesucht, die Ihnen etwas liefern könnten", en: "Looked for new companies that could supply you" } },
        {
          id: "one-company",
          label: {
            de: "Eine bestimmte Firma genauer geprüft: wer dahintersteht, was sie macht, ob sie verlässlich ist",
            en: "Took a closer look at one particular company: who's behind it, what it does, whether it's reliable",
          },
        },
        { id: "competitors", label: { de: "Mitbewerber im Auge behalten: wer was anbietet, und wo", en: "Kept an eye on competitors: who offers what, and where" } },
        { id: "own-position", label: { de: "Die eigene Firma mit Mitbewerbern verglichen: Preise, Grösse, Angebot", en: "Compared your own company with competitors: prices, size, what you offer" } },
      ],
      // analysis midpoints per year: 0 · 1.5 · 4.5 · 12 · 52 (design §3, question 10)
      scale: [
        { id: "never", label: { de: "Nie", en: "Never" } },
        { id: "1-2", label: { de: "1–2 Mal", en: "1–2 times" } },
        { id: "3-6", label: { de: "3–6 Mal", en: "3–6 times" } },
        { id: "monthly", label: { de: "Etwa monatlich", en: "About monthly" } },
        { id: "weekly", label: { de: "Wöchentlich oder öfter", en: "Weekly or more" } },
      ],
    },
    {
      id: "who",
      type: "single",
      text: { de: "Wer macht das in Ihrer Firma normalerweise?", en: "Who usually does this at your company?" },
      options: [
        { id: "me", label: { de: "Meistens ich selbst", en: "Mostly me" } },
        {
          id: "by-topic",
          label: {
            de: "Je nach Thema die zuständige Person: der Verkauf sucht Kunden, der Einkauf sucht Lieferanten",
            en: "Whoever the topic belongs to: sales looks for customers, purchasing looks for suppliers",
          },
        },
        { id: "dedicated", label: { de: "Dafür gibt es eine Person oder ein Team", en: "There's a person or team for it" } },
        { id: "external", label: { de: "Jemand von aussen, etwa ein Berater oder der Treuhänder", en: "Someone external, such as a consultant or our accountant" } },
        { id: "no-one", label: { de: "Niemand regelmässig; wer gerade Zeit hat", en: "No one regularly; whoever has time" } },
      ],
    },
    // ---- E: aided lists --------------------------------------------------
    {
      id: "skipped",
      type: "multi",
      text: { de: "Kam es in den letzten 12 Monaten vor, dass Sie …", en: "In the last 12 months, did it happen that you …" },
      help: CHOOSE_ALL,
      exclusive: ["none"],
      options: [
        {
          id: "stayed",
          label: {
            de: "bei einer Firma geblieben sind, die Sie schon kannten, weil eine Suche zu aufwendig gewesen wäre",
            en: "stayed with a company you already knew, because searching would have been too much effort",
          },
        },
        {
          id: "no-time",
          label: {
            de: "über eine Firma entschieden haben, ohne sie genauer anzuschauen, weil die Zeit fehlte",
            en: "decided about a company without looking into it, because there was no time",
          },
        },
        { id: "gave-up", label: { de: "eine Suche abgebrochen haben, weil Sie nichts Brauchbares fanden", en: "gave up a search, because you found nothing useful" } },
        {
          id: "no-source",
          label: {
            de: "gern etwas über Firmen gewusst hätten, aber nicht wussten, wo nachschauen",
            en: "wanted to know something about companies but didn't know where to look",
          },
        },
        { id: "no-need", label: { de: "bewusst nicht gesucht haben, weil es nicht nötig war", en: "deliberately didn't search, because there was no need" } },
        { id: "none", label: { de: "Nichts davon", en: "None of these" } },
      ],
    },
    {
      id: "sources",
      type: "multi",
      text: {
        de: "Wo haben Sie in den letzten 12 Monaten nachgeschaut oder nachgefragt, wenn Sie etwas über andere Firmen wissen wollten?",
        en: "In the last 12 months, where did you look or whom did you ask when you wanted to know something about other companies?",
      },
      help: CHOOSE_ALL,
      options: [
        { id: "website", label: { de: "Website der Firma", en: "The company's website" } },
        { id: "direct", label: { de: "Direkt bei der Firma: Anruf, Besuch, Referenzen", en: "The company itself: a call, a visit, references" } },
        { id: "register", label: { de: "Handelsregister, z.B. Zefix", en: "Commercial register, e.g. Zefix" } },
        { id: "search-engine", label: { de: "Suchmaschine", en: "Search engine" } },
        { id: "social", label: { de: "LinkedIn oder andere soziale Netzwerke", en: "LinkedIn or other social networks" } },
        { id: "credit-report", label: { de: "Bezahlte Wirtschafts- oder Bonitätsauskunft", en: "Paid business or credit report" } },
        { id: "directory", label: { de: "Branchenverzeichnis, Verband oder Messe", en: "Industry directory, association or trade fair" } },
        { id: "network", label: { de: "Persönliches Netzwerk: Kollegen, Kunden, Lieferanten", en: "Personal network: colleagues, customers, suppliers" } },
        { id: "ai", label: { de: "KI-Assistent, z.B. ChatGPT", en: "AI assistant, e.g. ChatGPT" } },
        { id: "press", label: { de: "Fachpresse, Medien", en: "Trade press, media" } },
        { id: "other", label: { de: "Anderes", en: "Other" } },
      ],
    },
    // ---- F: contact ------------------------------------------------------
    {
      id: "followup",
      type: "multi",
      text: { de: "Wären Sie offen für …", en: "Would you be open to …" },
      exclusive: ["neither"],
      email: { unlessOption: "neither", label: { de: "Ihre E-Mail-Adresse", en: "Your e-mail address" } },
      options: [
        { id: "conversation", label: { de: "ein 20-minütiges Gespräch", en: "a 20-minute conversation" } },
        { id: "trial", label: { de: "einen Test eines Werkzeugs in diesem Bereich später im Projekt", en: "trying a tool in this area later in the project" } },
        { id: "neither", label: { de: "weder noch", en: "neither" } },
      ],
    },
  ],
  skips: [
    { when: { question: "case", is: "none" }, skip: ["duration", "cost", "result", "gains"] },
    { when: { question: "activities", every: "never" }, skip: ["sources"] },
  ],
};
