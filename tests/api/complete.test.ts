import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerRow, ResponseRow } from "@/db";
import { FORM_VERSION } from "@/form";

vi.mock("@/db", () => ({ getResponse: vi.fn(), completeResponse: vi.fn(async () => "2026-09-22T11:00:00Z") }));
import * as db from "@/db";
import { POST } from "@/app/api/responses/[id]/complete/route";

const ID = "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f";
const row = (question_id: string, value: AnswerRow["value"]): AnswerRow => ({ question_id, followup_index: 0, question_text: "…", value });
const SHORT_PATH = [
  row("role", { option: "owner" }), row("size", { option: "1-9" }), row("relations", { options: ["none"] }),
  row("pains", { text: "p" }), row("gains", { text: "g" }), row("followup", { options: ["neither"] }),
];

function stored(answers: AnswerRow[], overrides: Partial<ResponseRow> = {}) {
  vi.mocked(db.getResponse).mockResolvedValue({
    response: {
      id: ID, company_uid: null, probe_allowed: false, lang: "en", form_version: FORM_VERSION,
      consented_at: "2026-09-22T10:00:00Z", completed_at: null, created_at: "2026-09-22T10:00:00Z", ...overrides,
    },
    answers,
  });
}

function complete(id = ID) {
  return POST(
    new Request(`http://localhost/api/responses/${id}/complete`, { method: "POST", headers: { "sec-fetch-site": "same-origin" } }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/responses/:id/complete", () => {
  it("completes a fully answered response and returns the reference code", async () => {
    stored(SHORT_PATH);
    const response = await complete();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ referenceCode: "3f1c2b7a" });
    expect(db.completeResponse).toHaveBeenCalledWith(ID);
  });

  it("refuses while a question is unanswered", async () => {
    stored(SHORT_PATH.slice(0, 4));
    expect((await complete()).status).toBe(409);
    expect(db.completeResponse).not.toHaveBeenCalled();
  });

  it("returns the same code again for an already completed response, without writing", async () => {
    stored(SHORT_PATH, { completed_at: "2026-09-22T11:00:00Z" });
    const response = await complete();
    expect(await response.json()).toEqual({ referenceCode: "3f1c2b7a" });
    expect(db.completeResponse).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown or malformed id and 403 cross-site", async () => {
    vi.mocked(db.getResponse).mockResolvedValue(null);
    expect((await complete()).status).toBe(404);
    expect((await complete("nope")).status).toBe(404);
    const crossSite = await POST(
      new Request(`http://localhost/api/responses/${ID}/complete`, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      { params: Promise.resolve({ id: ID }) },
    );
    expect(crossSite.status).toBe(403);
  });
});
