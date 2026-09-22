// Shared request handling for the route handlers: refuse cross-site requests
// and oversized bodies, parse JSON and check it with a Zod schema, and build
// JSON responses. Error bodies never repeat what the client sent.
import type { z } from "zod";

export const MAX_BODY_BYTES = 16 * 1024;

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

// A browser sends Sec-Fetch-Site on every request; only our own page may call
// the API. Tools without the header (curl, tests) are allowed — this stops
// other websites, not scripts.
function crossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  if (crossSite(request)) return { ok: false, response: json(403, { error: "forbidden" }) };

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, response: json(413, { error: "body too large" }) };

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, response: json(413, { error: "body too large" }) };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, response: json(400, { error: "invalid JSON" }) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, response: json(400, { error: "invalid request" }) };
  return { ok: true, data: parsed.data };
}

/** Refuses a cross-site GET the same way readJson refuses a POST. */
export function refuseCrossSite(request: Request): Response | null {
  return crossSite(request) ? json(403, { error: "forbidden" }) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
