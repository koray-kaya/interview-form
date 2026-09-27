// wholeList is the guard against Supabase's silent 1000-row cap: past that
// limit a select still returns 200 with a partial page, so we compare the
// rows we got against the exact count and fail loudly instead of paging
// through a short list as if it were the whole one (Important 1, #24).
import { describe, expect, it } from "vitest";
import { wholeList } from "@/db";

describe("wholeList", () => {
  it("returns the rows when their count matches the query's exact count", () => {
    const rows = [{ id: 1 }, { id: 2 }];
    expect(wholeList(rows, 2, "readTagSources")).toBe(rows);
  });

  it("throws naming both numbers when fewer rows came back than the count", () => {
    const rows = [{ id: 1 }];
    expect(() => wholeList(rows, 1000, "readTagSources")).toThrow(
      "readTagSources: got 1 of 1000 rows; page the query",
    );
  });

  it("throws when there is no count to compare against", () => {
    expect(() => wholeList([{ id: 1 }], null, "readTagSources")).toThrow(/readTagSources/);
  });
});
