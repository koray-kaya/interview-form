// Every UI string a participant sees, in German and English. Questions live
// in form.ts; this file holds everything around them.
import type { Text } from "@/i18n";

/** Where participants send their reference code to have their answers removed. */
export const CONTACT_EMAIL = "koray.kaya@ost.ch";

export const UI = {
  title: { de: "Wie Schweizer Firmen andere Firmen finden und prüfen", en: "How Swiss firms find and assess other companies" },
  intro: {
    de: "Ich bin Koray Kaya und schreibe meine Masterarbeit an der OST, der Ostschweizer Fachhochschule. Dafür stelle ich Firmen in der Ostschweiz eine einzige Frage: Wie informieren Sie sich heute über andere Firmen, etwa einen möglichen Kunden, einen Lieferanten oder einen Mitbewerber, und was kostet Sie das?",
    en: "I'm Koray Kaya, and I'm writing my master's thesis at OST, the Eastern Switzerland University of Applied Sciences. For it, I'm asking firms in eastern Switzerland one question: how do you find out about other companies today, say a possible customer, a supplier or a competitor, and what does that cost you?",
  },
  /** Starts with the number of questions; a test holds it to the form. */
  howLong: {
    de: "14 kurze Fragen, etwa 10 Minuten: drei zum Schreiben, der Rest zum Antippen. Es gibt keine richtigen Antworten; mich interessiert, wie Sie tatsächlich arbeiten.",
    en: "14 short questions, about 10 minutes: three to write, the rest to tap. There are no right answers; I want to know how you actually work.",
  },
  promise: {
    de: "Ihre Antworten werden nur für diese Masterarbeit verwendet und ohne Firmennamen ausgewertet. Auf drei Ihrer schriftlichen Antworten können ein oder zwei kurze Rückfragen folgen; diese Rückfragen schreibt eine KI. Sie können jederzeit abbrechen.",
    en: "Your answers are used only for this thesis and reported without company names. Three of your written answers may get one or two short follow-up questions, written by an AI. You can stop at any time.",
  },
  detailsLabel: { de: "Details", en: "Details" },
  details: {
    de: `Dieser Link ist für Ihre Firma bestimmt; ich nutze das nur, um Sie nicht zweimal einzuladen und um Sie zu erreichen, wenn Sie das wünschen. Verantwortlich: Koray Kaya, OST, ${CONTACT_EMAIL}. Wenn Sie den Referenzcode von der letzten Seite an diese Adresse schicken, werden Ihre Antworten gelöscht.`,
    en: `This link is meant for your company; I use that only to avoid inviting you twice and to reach you if you wish. Responsible: Koray Kaya, OST, ${CONTACT_EMAIL}. Send the reference code from the last page to this address and your answers will be deleted.`,
  },
  consent: { de: "Ich habe das gelesen und mache mit.", en: "I have read this and agree to take part." },
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
  answerEveryRow: { de: "Bitte wählen Sie in jeder Zeile eine Antwort.", en: "Please choose an answer in every row." },
  thanksTitle: { de: "Vielen Dank", en: "Thank you" },
  thanksBody: { de: "Ihre Antworten sind gespeichert.", en: "Your answers are saved." },
  referenceCode: { de: "Ihr Referenzcode", en: "Your reference code" },
  withdraw: {
    de: `Wenn Sie Ihre Antworten löschen lassen möchten, senden Sie diesen Code an ${CONTACT_EMAIL}.`,
    en: `If you want your answers removed, send this code to ${CONTACT_EMAIL}.`,
  },
  inTouch: { de: "Ich melde mich per E-Mail bei Ihnen.", en: "I will be in touch by e-mail." },
  saving: { de: "Speichern …", en: "Saving …" },
  oneMoment: { de: "Einen Moment …", en: "One moment …" },
  saveFailed: {
    de: "Ihre Antwort konnte nicht gespeichert werden. Bitte prüfen Sie die Verbindung und drücken Sie erneut OK.",
    en: "Your answer could not be saved. Please check your connection and press OK again.",
  },
  tooMany: {
    de: "Zu viele Anfragen in kurzer Zeit aus diesem Netzwerk. Bitte versuchen Sie es in ein paar Minuten erneut.",
    en: "Too many requests in a short time from this network. Please try again in a few minutes.",
  },
  startFailed: {
    de: "Die Umfrage konnte nicht gestartet werden. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.",
    en: "The survey could not be started. Please check your connection and try again.",
  },
  langDe: { de: "Deutsch", en: "Deutsch" },
  langEn: { de: "English", en: "English" },
} satisfies Record<string, Text>;
