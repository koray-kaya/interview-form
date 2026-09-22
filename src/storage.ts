// Mirrors the form state to localStorage so a refresh resumes where the
// participant was. Browser storage can be missing or throw (private mode,
// blocked storage), and what it returns may be stale or edited, so every read
// is checked with Zod and any failure means "no state". Once the form is done
// no answers stay in the browser. M2 replaces the answers here with a
// server-side response id.
import { z } from "zod";
import { FORM_VERSION } from "@/form";
import { AnswersSchema, type Answers } from "@/engine";
import type { Lang } from "@/i18n";

const KEY = "interview-form";

const SavedSchema = z.object({
  version: z.string(),
  lang: z.enum(["de", "en"]),
  stage: z.enum(["welcome", "questions", "done"]),
  answers: AnswersSchema,
});

export type Stage = z.infer<typeof SavedSchema>["stage"];
export type Saved = { version: string; lang: Lang; stage: Stage; answers: Answers };

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = SavedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.version !== FORM_VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveSaved(saved: Saved): void {
  // a finished form keeps only enough to show the thank-you page again
  const kept = saved.stage === "done" ? { ...saved, answers: {} } : saved;
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // storage unavailable — the form still works, it just will not resume
  }
}

export function clearSaved(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // same as above
  }
}
