import { beforeEach, describe, expect, it, vi } from "vitest";
import { FORM_VERSION } from "@/form";

// The database is mocked: these tests check what the routes decide, not Supabase.
vi.mock("@/db", () => ({
  createResponse: vi.fn(async () => "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f"),
  getResponse: vi.fn(),
}));
import * as db from "@/db";
import { POST } from "@/app/api/responses/route";
import { GET } from "@/app/api/responses/[id]/route";

const ID = "3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f";

function create(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/responses", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function resume(id: string) {
  return GET(new Request(`http://localhost/api/responses/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/responses", () => {
  it("creates a response with the form version and no probing yet", async () => {
    const response = await create({ c: " CHE123456789 ", lang: "de", consent: true });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID, probeAllowed: false });
    expect(db.createResponse).toHaveBeenCalledWith({
      companyUid: "CHE123456789",
      lang: "de",
      formVersion: FORM_VERSION,
      probeAllowed: false,
    });
  });

  it("stores no tag when c is missing or empty", async () => {
    await create({ lang: "en", consent: true });
    await create({ c: "  ", lang: "en", consent: true });
    for (const call of vi.mocked(db.createResponse).mock.calls) expect(call[0].companyUid).toBeNull();
  });

  it("refuses without consent", async () => {
    for (const body of [{ lang: "de" }, { lang: "de", consent: false }, { lang: "de", consent: "yes" }]) {
      expect((await create(body)).status).toBe(400);
    }
    expect(db.createResponse).not.toHaveBeenCalled();
  });

  it("refuses an unknown language, an overlong tag and a cross-site request", async () => {
    expect((await create({ lang: "fr", consent: true })).status).toBe(400);
    expect((await create({ c: "x".repeat(33), lang: "de", consent: true })).status).toBe(400);
    expect((await create({ lang: "de", consent: true }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(db.createResponse).not.toHaveBeenCalled();
  });
});

describe("GET /api/responses/:id", () => {
  it("returns the answers for resume", async () => {
    vi.mocked(db.getResponse).mockResolvedValue({
      response: {
        id: ID, company_uid: null, probe_allowed: false, lang: "en", form_version: FORM_VERSION,
        consented_at: "2026-09-22T10:00:00Z", completed_at: null, created_at: "2026-09-22T10:00:00Z",
      },
      answers: [{ question_id: "role", followup_index: 0, question_text: "Your role", value: { option: "sales" } }],
    });
    const response = await resume(ID);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lang: "en",
      formVersion: FORM_VERSION,
      completed: false,
      answered: [{ questionId: "role", followupIndex: 0, questionText: "Your role", value: { option: "sales" } }],
    });
  });

  it("answers 404 for an unknown or malformed id, without asking the database for the malformed one", async () => {
    vi.mocked(db.getResponse).mockResolvedValue(null);
    expect((await resume(ID)).status).toBe(404);
    expect((await resume("nope")).status).toBe(404);
    expect(db.getResponse).toHaveBeenCalledTimes(1);
  });
});
