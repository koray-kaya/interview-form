// Reads the probe instructions from prompts/probe.md — the file the thesis
// prints. The first line carries its version ("version: 1"), which is logged
// with every model call. Read once per server process.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Prompt = { version: string; text: string };

let cached: Prompt | null = null;

export function loadPrompt(): Prompt {
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), "prompts", "probe.md"), "utf8");
  const [first, ...rest] = raw.split("\n");
  const version = /^version:\s*(\S+)\s*$/.exec(first)?.[1];
  if (!version) throw new Error("prompts/probe.md must start with a 'version: N' line");
  cached = { version, text: rest.join("\n").trim() };
  return cached;
}
