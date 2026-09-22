import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isUuid, json, readJson } from "@/http";

const Schema = z.object({ name: z.string() });

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    body,
  });
}

describe("readJson", () => {
  it("returns the parsed body", async () => {
    const result = await readJson(post('{"name":"a"}'), Schema);
    expect(result).toEqual({ ok: true, data: { name: "a" } });
  });

  it("accepts a request without Sec-Fetch-Site (curl, tests) or with none", async () => {
    const plain = new Request("http://localhost/api/x", { method: "POST", body: '{"name":"a"}' });
    expect((await readJson(plain, Schema)).ok).toBe(true);
    expect((await readJson(post('{"name":"a"}', { "sec-fetch-site": "none" }), Schema)).ok).toBe(true);
  });

  it("refuses a cross-site request with 403", async () => {
    const result = await readJson(post('{"name":"a"}', { "sec-fetch-site": "cross-site" }), Schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("refuses a body over 16 kB with 413, by header or by size", async () => {
    const big = JSON.stringify({ name: "x".repeat(17_000) });
    const byHeader = await readJson(post('{"name":"a"}', { "content-length": "20000" }), Schema);
    const bySize = await readJson(post(big), Schema);
    for (const result of [byHeader, bySize]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(413);
    }
  });

  it("refuses invalid JSON or the wrong shape with 400, without echoing the input", async () => {
    for (const body of ["{not json", '{"name":42}']) {
      const result = await readJson(post(body), Schema);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        expect(await result.response.text()).not.toContain("42");
      }
    }
  });
});

describe("helpers", () => {
  it("json sets status and body", async () => {
    const response = json(201, { id: "x" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "x" });
  });

  it("isUuid accepts a v4 uuid only", () => {
    expect(isUuid("3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("3f1c2b7a-9d4e-4c1a-8b2f-0a1b2c3d4e5f; drop")).toBe(false);
  });
});
