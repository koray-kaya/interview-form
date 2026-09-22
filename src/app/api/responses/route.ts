// POST /api/responses — starts a response once the participant has consented.
// The company tag (?c=) is stored as given; it is a label, never identity.
// Probing stays off until M3 checks the tag's check digit.
import { z } from "zod";
import { createResponse } from "@/db";
import { FORM_VERSION } from "@/form";
import { json, readJson } from "@/http";

const Body = z.object({
  c: z.string().max(32).optional(),
  lang: z.enum(["de", "en"]),
  consent: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const tag = parsed.data.c?.trim() || null;
  const id = await createResponse({
    companyUid: tag,
    lang: parsed.data.lang,
    formVersion: FORM_VERSION,
    probeAllowed: false,
  });
  return json(201, { id, probeAllowed: false });
}
