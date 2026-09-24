// Mirrors where the participant is to localStorage so a refresh resumes: the
// server's response id, the language, the stage, the link's code, and, once
// done, the reference code. Answers are never kept in the browser — the
// server holds them.
// Browser storage can be missing, stale or edited, so every read is checked
// with Zod and any failure means "no state".
import { z } from "zod";
import { FORM_VERSION } from "@/form";

const KEY = "interview-form";

const SavedSchema = z.object({
  version: z.string(),
  lang: z.enum(["de", "en"]),
  stage: z.enum(["welcome", "questions", "done"]),
  responseId: z.uuid().nullable(),
  referenceCode: z.string().regex(/^[0-9a-f]{8}$/).optional(),
  inTouch: z.boolean().optional(),
  /** The link's code (?c=) this state belongs to; absent in state saved before 2026-09-24. */
  tag: z.string().max(32).nullable().optional(),
});

export type Saved = z.infer<typeof SavedSchema>;
export type Stage = Saved["stage"];

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
  // parse drops any field the schema does not name, so nothing else is written
  const kept = SavedSchema.safeParse(saved);
  if (!kept.success) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(kept.data));
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
