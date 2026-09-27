import { describe, expect, it } from "vitest";
import { toTags, type TagSource } from "@/tags";

describe("toTags", () => {
  it("gives each tagged response's tag and times, and nothing else", () => {
    expect(
      toTags([
        // Extra columns a real row carries (id, lang) prove they are dropped,
        // not just absent from this fixture (Minor 4, #24). Cast: TagSource
        // does not declare them.
        {
          company_uid: "P-7K3Q9X",
          created_at: "2026-10-03T10:00:00+00:00",
          completed_at: null,
          id: "3f1c2b7a-1111-4aaa-9bbb-000000000001",
          lang: "de",
        } as unknown as TagSource,
        { company_uid: "CHE000000046", created_at: "2026-10-02T09:00:00+00:00", completed_at: "2026-10-02T09:12:00+00:00" },
      ]),
    ).toEqual([
      { tag: "P-7K3Q9X", started_at: "2026-10-03T10:00:00+00:00", completed_at: null },
      { tag: "CHE000000046", started_at: "2026-10-02T09:00:00+00:00", completed_at: "2026-10-02T09:12:00+00:00" },
    ]);
  });

  it("leaves out untagged responses and the smoke test's", () => {
    expect(
      toTags([
        { company_uid: null, created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
        { company_uid: "", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
        { company_uid: "SMOKE", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
      ]),
    ).toEqual([]);
  });
});
