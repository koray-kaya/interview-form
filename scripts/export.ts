// `npm run export` — writes every row to data/export-YYYY-MM-DD.json on this
// machine (data/ is gitignored). Reads .env.local through Node's --env-file.
import { mkdirSync, writeFileSync } from "node:fs";
import { buildExport } from "@/export";

const data = await buildExport();
mkdirSync("data", { recursive: true });
const path = `data/export-${data.exportedAt.slice(0, 10)}.json`;
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`${path}: ${data.responses.length} responses, ${data.answers.length} answers, ${data.probe_calls.length} probe calls`);
