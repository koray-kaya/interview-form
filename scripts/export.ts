// `npm run export` — writes every row to data/export-YYYY-MM-DD.json and the
// analysis table (one row per completed response) to data/export-YYYY-MM-DD.csv
// on this machine (data/ is gitignored). Reads .env.local through --env-file.
// Wrapped in main() because tsx runs this file as CommonJS, where a
// top-level await is not allowed.
import { mkdirSync, writeFileSync } from "node:fs";
import { toCsv, type CsvAnswer, type CsvResponse } from "@/csv";
import { buildExport } from "@/export";

async function main() {
  const data = await buildExport();
  mkdirSync("data", { recursive: true });
  const base = `data/export-${data.exportedAt.slice(0, 10)}`;
  writeFileSync(`${base}.json`, JSON.stringify(data, null, 2) + "\n");
  const csv = toCsv(data.form, data.responses as CsvResponse[], data.answers as CsvAnswer[]);
  writeFileSync(`${base}.csv`, csv);
  const rows = csv.split("\r\n").filter(Boolean).length - 1;
  console.log(`${base}.json: ${data.responses.length} responses, ${data.answers.length} answers, ${data.probe_calls.length} probe calls`);
  console.log(`${base}.csv: ${rows} completed responses of form ${data.formVersion}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
