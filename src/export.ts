// One JSON document with every row of the three tables, plus when it was
// taken and the form it was taken under: the answers store option, row and
// scale ids, and the form turns them back into the words people saw. The daily
// cron writes it to Blob and `npm run export` writes it to data/. Contains
// participant data: never commit it, never make it public.
import { readAll } from "@/db";
import { FORM, FORM_VERSION, type Form } from "@/form";

export async function buildExport(): Promise<{
  exportedAt: string;
  formVersion: string;
  form: Form;
  responses: unknown[];
  answers: unknown[];
  probe_calls: unknown[];
}> {
  const tables = await readAll();
  return { exportedAt: new Date().toISOString(), formVersion: FORM_VERSION, form: FORM, ...tables };
}
