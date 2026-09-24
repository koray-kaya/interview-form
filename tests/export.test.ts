import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  readAll: vi.fn(async () => ({
    responses: [],
    answers: [{ question_id: "activities", followup_index: 0, value: { rows: { competitors: "weekly" } } }],
    probe_calls: [],
  })),
}));
import { buildExport } from "@/export";

describe("buildExport", () => {
  it("carries the form it was taken under, so the ids in the answers can be read back", async () => {
    const data = await buildExport();
    expect(data.formVersion).toBe("2.0.0");
    const activities = data.form.questions.find((q) => q.id === "activities");
    expect(activities?.type === "rows" && activities.scale.find((p) => p.id === "weekly")?.label.en).toBe("Weekly or more");
    expect(data.answers).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});
