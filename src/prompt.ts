// Reads the probe instructions for one question from prompts/probe-<id>.md —
// the files the thesis prints. Each starts with two header lines,
// "version: N" and "question: <id>"; the version is logged with every model
// call. Files are read once per server process.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Prompt = { questionId: string; version: string; text: string };

const cache = new Map<string, Prompt>();

export function loadPrompt(questionId: string): Prompt {
  const cached = cache.get(questionId);
  if (cached) return cached;
  const file = join(process.cwd(), "prompts", `probe-${questionId}.md`);
  const [first, second, ...rest] = readFileSync(file, "utf8").split("\n");
  const version = /^version:\s*(\S+)\s*$/.exec(first)?.[1];
  const question = /^question:\s*(\S+)\s*$/.exec(second)?.[1];
  if (!version || question !== questionId) {
    throw new Error(`${file} must start with "version: N" and "question: ${questionId}"`);
  }
  const prompt = { questionId, version, text: rest.join("\n").trim() };
  cache.set(questionId, prompt);
  return prompt;
}
