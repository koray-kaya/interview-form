// The browser's side of the API: one function per route, plain fetch, JSON in
// and out. A request that fails on the network is sent once more (the server
// upserts, so a repeat is harmless). Anything else that goes wrong becomes an
// ApiError with the HTTP status and, when the server sent one, its message.
import type { AnswerValue } from "@/engine";
import type { Lang } from "@/i18n";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Resumed = {
  lang: Lang;
  formVersion: string;
  completed: boolean;
  answered: { questionId: string; followupIndex: number; questionText: string; value: AnswerValue }[];
  /** Follow-ups the participant saw but did not answer; the screen shows them again. */
  pending: { questionId: string; index: number; text: string }[];
};

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    return await fetch(path, init); // one retry on a network failure
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await send(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, typeof data.error === "string" ? data.error : "request failed");
  return data as T;
}

export function startResponse(input: { c?: string; lang: Lang }): Promise<{ id: string; probeAllowed: boolean }> {
  return call("/api/responses", { ...input, consent: true });
}

/** The stored response, or null when the server no longer knows the id. */
export async function fetchResponse(id: string): Promise<Resumed | null> {
  try {
    return await call<Resumed>(`/api/responses/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function postAnswer(
  id: string,
  questionId: string,
  value: AnswerValue,
  lang: Lang,
): Promise<{ followUp: null }> {
  return call(`/api/responses/${id}/answers`, { questionId, followupIndex: 0, value, lang });
}

export function completeResponse(id: string): Promise<{ referenceCode: string }> {
  return call(`/api/responses/${id}/complete`, {});
}
