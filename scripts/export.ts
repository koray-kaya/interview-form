// `npm run export` — writes every row to data/export-YYYY-MM-DD.json on this
// machine (data/ is gitignored). Reads .env.local through --env-file.
// Wrapped in main() because tsx runs this file as CommonJS, where a
// top-level await is not allowed.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildExport } from "@/export";

async function main() {
  const data = await buildExport();
  mkdirSync("data", { recursive: true });
  const path = `data/export-${data.exportedAt.slice(0, 10)}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`${path}: ${data.responses.length} responses, ${data.answers.length} answers, ${data.probe_calls.length} probe calls`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
