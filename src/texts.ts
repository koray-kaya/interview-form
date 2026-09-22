// Every UI string a participant sees, in German and English. Questions live
// in form.ts; this file holds everything around them.
import type { Text } from "@/i18n";

export const UI = {
  title: { de: "Wie Schweizer Unternehmen andere Unternehmen unter die Lupe nehmen", en: "How Swiss firms look into other companies" },
  intro: {
    de: "Ich bin Masterstudent in der Schweiz. Meine Arbeit fragt, wie Schweizer Unternehmen sich über andere Unternehmen informieren — einen möglichen Kunden, einen Lieferanten, einen Mitbewerber — und was sie das heute kostet. 8 kurze Fragen, etwa 6 Minuten. Es gibt keine richtigen Antworten; mich interessiert, wie Sie tatsächlich arbeiten.",
    en: "I am a master's student in Switzerland. My thesis asks how Swiss firms find out about other companies — a possible customer, a supplier, a competitor — and what that costs them today. 8 short questions, about 6 minutes. There are no right answers; I am interested in how you actually work.",
  },
  privacy: {
    de: "Dieser Link ist für Ihr Unternehmen bestimmt. Ich nutze das nur, um Sie nicht zweimal einzuladen und um Sie zu erreichen, wenn Sie das wünschen. Ergebnisse werden ohne Firmennamen berichtet. Drei Ihrer schriftlichen Antworten können ein bis zwei kurze Rückfragen erhalten, die ein KI-Dienst formuliert (Anthropic, über Vercel); diese Antworten werden nicht zum Training von Modellen verwendet. Die Daten werden in der Schweiz gespeichert (Supabase, Zürich). Sie können jederzeit abbrechen; unvollständige Antworten werden gelöscht.",
    en: "This link is specific to your company. I use that only to avoid inviting you twice and to reach you if you ask me to. Results are reported without company names. Three of your written answers may receive one or two short follow-up questions written by an AI service (Anthropic, via Vercel); those answers are not used to train models. Data is stored in Switzerland (Supabase, Zurich). You can stop at any time; unfinished answers are deleted.",
  },
  consent: { de: "Ich habe das gelesen und nehme teil.", en: "I have read this and agree to take part." },
  start: { de: "Start", en: "Start" },
  ok: { de: "OK", en: "OK" },
  back: { de: "Zurück", en: "Back" },
  next: { de: "Weiter", en: "Next" },
  shiftEnter: { de: "Shift ⇧ + Enter ↵ für einen Zeilenumbruch", en: "Shift ⇧ + Enter ↵ to make a line break" },
  pressEnter: { de: "Enter ↵ drücken", en: "press Enter ↵" },
  placeholder: { de: "Ihre Antwort …", en: "Type your answer here …" },
  emailPlaceholder: { de: "name@firma.ch", en: "name@company.ch" },
  required: { de: "Bitte beantworten Sie diese Frage.", en: "Please answer this question." },
  tooLong: { de: "Bitte kürzen Sie Ihre Antwort auf 4000 Zeichen.", en: "Please shorten your answer to 4,000 characters." },
  emailRequired: { de: "Bitte geben Sie eine E-Mail-Adresse an, damit ich Sie erreichen kann.", en: "Please enter an e-mail address so that I can reach you." },
  emailInvalid: { de: "Diese E-Mail-Adresse sieht nicht richtig aus.", en: "This e-mail address does not look right." },
  chooseOne: { de: "Bitte wählen Sie eine Antwort.", en: "Please choose an answer." },
  thanksTitle: { de: "Vielen Dank", en: "Thank you" },
  thanksBody: { de: "Ihre Antworten sind gespeichert.", en: "Your answers are saved." },
  langDe: { de: "Deutsch", en: "Deutsch" },
  langEn: { de: "English", en: "English" },
} satisfies Record<string, Text>;
