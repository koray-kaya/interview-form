// The form as data: eight questions in German and English, the skip rule,
// and which open questions the AI may probe (M3). Changing a question means
// changing this file and bumping FORM_VERSION. Plain TypeScript, no library.
import type { Text } from "@/i18n";

export const FORM_VERSION = "1.0.0";

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
  /** Choosing this option clears the others, and vice versa. */
  exclusive?: string;
  /** Ask for an e-mail address unless only this option is chosen. */
  email?: { unlessOption: string; label: Text };
};

export type OpenQuestion = {
  id: string;
  type: "open";
  text: Text;
  help?: Text;
  maxChars: number;
  /** AI follow-ups: at most maxFollowUps model calls; what the model looks for is in prompts/probe-<id>.md. */
  probe?: { maxFollowUps: number; context?: string[] };
};

export type Question = SingleQuestion | MultiQuestion | OpenQuestion;

export type Skip = { when: { question: string; is: string }; skip: string[] };

export type Form = { version: string; questions: Question[]; skips: Skip[] };

export const FORM: Form = {
  version: FORM_VERSION,
  questions: [
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
      text: { de: "Wie viele Personen arbeiten in Ihrem Unternehmen?", en: "How many people work at your company?" },
      options: [
        { id: "1-9", label: { de: "1–9", en: "1–9" } },
        { id: "10-49", label: { de: "10–49", en: "10–49" } },
        { id: "50-99", label: { de: "50–99", en: "50–99" } },
        { id: "100-249", label: { de: "100–249", en: "100–249" } },
        { id: "250+", label: { de: "250 oder mehr", en: "250 or more" } },
      ],
    },
    {
      id: "relations",
      type: "multi",
      text: {
        de: "Haben Sie sich in den letzten 12 Monaten über ein anderes Unternehmen informiert, weil Sie …",
        en: "In the last 12 months, did you look into another company because you needed …",
      },
      help: { de: "Mehrfachauswahl möglich.", en: "Choose all that apply." },
      exclusive: "none",
      options: [
        { id: "customer", label: { de: "einen neuen Kunden suchten", en: "a new customer" } },
        { id: "supplier", label: { de: "einen neuen Lieferanten suchten", en: "a new supplier" } },
        { id: "competitor", label: { de: "einen Mitbewerber kennen wollten", en: "to know a competitor" } },
        { id: "position", label: { de: "wissen wollten, wo Ihr eigenes Unternehmen steht", en: "to see where your own company stands" } },
        { id: "none", label: { de: "nichts davon", en: "none of these" } },
      ],
    },
    {
      id: "case",
      type: "open",
      text: {
        de: "Denken Sie an den letzten Fall. Was mussten Sie herausfinden, und wie sind Sie vorgegangen?",
        en: "Think of the most recent case. What did you need to find out, and how did you go about it?",
      },
      maxChars: 4000,
      probe: {
        maxFollowUps: 2,
      },
    },
    {
      id: "duration",
      type: "single",
      text: { de: "Wie lange hat das insgesamt etwa gedauert?", en: "Roughly how long did that take in total?" },
      options: [
        { id: "lt30m", label: { de: "Unter 30 Minuten", en: "Under 30 minutes" } },
        { id: "lt2h", label: { de: "Bis 2 Stunden", en: "Up to 2 hours" } },
        { id: "halfday", label: { de: "Etwa einen halben Tag", en: "About half a day" } },
        { id: "day+", label: { de: "Einen Tag oder mehr", en: "A day or more" } },
        { id: "weeks", label: { de: "Über Wochen verteilt", en: "Spread over weeks" } },
      ],
    },
    {
      id: "pains",
      type: "open",
      text: {
        de: "Wenn Sie sich über andere Unternehmen informieren: Wo hakt es, wo dauert es länger als nötig, wo geben Sie auf?",
        en: "When you look into other companies, where does it get stuck, take longer than it should, or make you give up?",
      },
      help: { de: "Ein konkretes Beispiel hilft am meisten.", en: "A concrete example helps most." },
      maxChars: 4000,
      probe: {
        maxFollowUps: 2,
        context: ["case"],
      },
    },
    {
      id: "gains",
      type: "open",
      text: {
        de: "Rückblickend auf diesen Fall: Wie hätte ein wirklich gutes Ergebnis ausgesehen, und was hätte es für Sie verändert?",
        en: "Looking back at that case: what would a really good result have looked like, and what would it have changed for you?",
      },
      maxChars: 4000,
      probe: {
        maxFollowUps: 2,
        context: ["case"],
      },
    },
    {
      id: "followup",
      type: "multi",
      text: { de: "Wären Sie offen für …", en: "Would you be open to …" },
      exclusive: "neither",
      email: { unlessOption: "neither", label: { de: "Ihre E-Mail-Adresse", en: "Your e-mail address" } },
      options: [
        { id: "conversation", label: { de: "ein 20-minütiges Gespräch", en: "a 20-minute conversation" } },
        { id: "trial", label: { de: "einen Test eines Werkzeugs in diesem Bereich später im Projekt", en: "trying a tool in this area later in the project" } },
        { id: "neither", label: { de: "weder noch", en: "neither" } },
      ],
    },
  ],
  skips: [{ when: { question: "relations", is: "none" }, skip: ["case", "duration"] }],
};
