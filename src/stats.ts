// The numbers on the admin page, computed from a few columns of the tables:
// how many responses are complete or under way, how recent, in which
// language, from which kind of link, and what the model decided. No answer
// text is read. Pure function, tested without a database.
import { SMOKE_TAG } from "@/responses";

export type StatsResponse = {
  company_uid: string | null;
  lang: string;
  form_version: string;
  created_at: string;
  completed_at: string | null;
};

export type StatsCall = { decision: string };

export type Stats = {
  completed: number;
  unfinished: number;
  completedToday: number;
  completedLast7Days: number;
  medianMinutes: number | null;
  byLang: { de: number; en: number };
  byLink: { uid: number; personal: number; none: number };
  calls: { total: number; asked: number; errors: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const zurichDay = (date: Date) => date.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

export function summarize(responses: StatsResponse[], calls: StatsCall[], formVersion: string, now: Date): Stats {
  const real = responses.filter((r) => r.form_version === formVersion && r.company_uid !== SMOKE_TAG);
  const done = real.filter((r) => r.completed_at !== null);
  const finished = (r: StatsResponse) => new Date(r.completed_at!);
  return {
    completed: done.length,
    unfinished: real.length - done.length,
    completedToday: done.filter((r) => zurichDay(finished(r)) === zurichDay(now)).length,
    completedLast7Days: done.filter((r) => now.getTime() - finished(r).getTime() <= 7 * DAY_MS).length,
    medianMinutes: median(done.map((r) => (finished(r).getTime() - new Date(r.created_at).getTime()) / 60_000)),
    byLang: {
      de: done.filter((r) => r.lang === "de").length,
      en: done.filter((r) => r.lang === "en").length,
    },
    byLink: {
      uid: done.filter((r) => r.company_uid !== null && !r.company_uid.startsWith("P-")).length,
      personal: done.filter((r) => r.company_uid?.startsWith("P-")).length,
      none: done.filter((r) => r.company_uid === null).length,
    },
    calls: {
      total: calls.length,
      asked: calls.filter((c) => c.decision === "ask").length,
      errors: calls.filter((c) => c.decision === "error").length,
    },
  };
}
