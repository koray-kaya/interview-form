// GET /api/cron/daily — run by Vercel Cron once a day (vercel.json). Keeps the
// Supabase project awake, deletes the smoke test's responses and those left
// unfinished for more than seven days (design §7), and writes a private JSON
// export to Vercel Blob when a Blob token is configured. Only a caller with
// CRON_SECRET may run it.
import { timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
import { deleteSmokeResponses, deleteUnfinishedBefore, touch } from "@/db";
import { serverEnv } from "@/env";
import { buildExport } from "@/export";
import { json } from "@/http";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Compares in constant time, so the answer time does not leak the secret.
function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request): Promise<Response> {
  const env = serverEnv();
  if (!authorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return json(401, { error: "unauthorized" });
  }

  await touch();
  // cleanup first: a failing export below must not keep test or stale rows
  const smoke = await deleteSmokeResponses();
  const deleted = await deleteUnfinishedBefore(new Date(Date.now() - SEVEN_DAYS_MS));

  let exported = 0;
  if (env.BLOB_READ_WRITE_TOKEN) {
    const data = await buildExport();
    const day = data.exportedAt.slice(0, 10);
    await put(`exports/${day}.json`, JSON.stringify(data), {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    exported = data.responses.length;
  }

  return json(200, { deleted, smoke, exported });
}
