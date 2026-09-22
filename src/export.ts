// One JSON document with every row of the three tables, plus when and from
// which form version it was taken. The daily cron writes it to Blob and
// `npm run export` writes it to data/. Contains participant data: never
// commit it, never make it public.
import { readAll } from "@/db";
import { FORM_VERSION } from "@/form";

export async function buildExport(): Promise<{
  exportedAt: string;
  formVersion: string;
  responses: unknown[];
  answers: unknown[];
  probe_calls: unknown[];
}> {
  const tables = await readAll();
  return { exportedAt: new Date().toISOString(), formVersion: FORM_VERSION, ...tables };
}
