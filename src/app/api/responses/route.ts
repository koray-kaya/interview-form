// POST /api/responses — starts a response once the participant has consented.
// The link's tag (?c=) is stored as given: a company number (UID), a personal
// code from the admin page, or nothing. It is a label, never identity. AI
// follow-ups run for every response except the smoke test's (decided
// 2026-09-24; the monthly AI Gateway budget caps the cost).
import { z } from "zod";
import { createResponse } from "@/db";
import { FORM_VERSION } from "@/form";
import { json, readJson } from "@/http";
import { SMOKE_TAG } from "@/responses";

const Body = z.object({
  c: z.string().max(32).optional(),
  lang: z.enum(["de", "en"]),
  consent: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const tag = parsed.data.c?.trim() || null;
  const probeAllowed = tag !== SMOKE_TAG;
  const id = await createResponse({
    companyUid: tag,
    lang: parsed.data.lang,
    formVersion: FORM_VERSION,
    probeAllowed,
  });
  return json(201, { id, probeAllowed });
}
