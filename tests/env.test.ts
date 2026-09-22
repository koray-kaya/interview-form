import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/env";

// A made-up key, assembled at runtime so secret scanners do not mistake it for a real one.
const FAKE_SECRET_KEY = ["sb", "secret", "test".repeat(4)].join("_");

const good = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: FAKE_SECRET_KEY,
  CRON_SECRET: "x".repeat(32),
};

describe("parseServerEnv", () => {
  it("accepts a complete environment; the Blob token is optional", () => {
    expect(parseServerEnv(good)).toEqual({ ...good, BLOB_READ_WRITE_TOKEN: undefined });
  });

  it("names the missing variable", () => {
    expect(() => parseServerEnv({ ...good, SUPABASE_URL: undefined })).toThrow(/SUPABASE_URL/);
  });

  it("rejects a legacy or public key and never prints the value", () => {
    const leaked = "eyJhbGciOiJIUzI1NiJ9.secret-looking-value";
    let message = "";
    try {
      parseServerEnv({ ...good, SUPABASE_SECRET_KEY: leaked });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SUPABASE_SECRET_KEY/);
    expect(message).not.toContain(leaked);
  });

  it("requires a long cron secret", () => {
    expect(() => parseServerEnv({ ...good, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });
});
