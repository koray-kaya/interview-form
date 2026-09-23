// POST /api/responses — starts a response once the participant has consented.
// The company tag (?c=) is stored as given; it is a label, never identity.
// AI follow-ups are allowed only when the tag is a valid Swiss UID (a cost
// gate: a stripped or made-up tag gets the fixed questions only).
import { z } from "zod";
import { createResponse } from "@/db";
import { FORM_VERSION } from "@/form";
import { json, readJson } from "@/http";
import { isValidUid } from "@/uid";

const Body = z.object({
  c: z.string().max(32).optional(),
  lang: z.enum(["de", "en"]),
  consent: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request, Body);
  if (!parsed.ok) return parsed.response;

  const tag = parsed.data.c?.trim() || null;
  const probeAllowed = tag !== null && isValidUid(tag);
  const id = await createResponse({
    companyUid: tag,
    lang: parsed.data.lang,
    formVersion: FORM_VERSION,
    probeAllowed,
  });
  return json(201, { id, probeAllowed });
}
