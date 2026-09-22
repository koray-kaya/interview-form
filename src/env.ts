// Reads the server's secrets from the environment and checks them with Zod.
// Only route handlers and scripts call this; none of these names start with
// NEXT_PUBLIC_, so Next.js never puts them in the browser bundle. Error
// messages name the variable, never its value.
import { z } from "zod";

const ServerEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_", "must be a secret key (sb_secret_…)"),
  CRON_SECRET: z.string().min(32, "must be at least 32 characters"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = ServerEnvSchema.safeParse({
    SUPABASE_URL: source.SUPABASE_URL,
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY,
    CRON_SECRET: source.CRON_SECRET,
    BLOB_READ_WRITE_TOKEN: source.BLOB_READ_WRITE_TOKEN || undefined,
  });
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Server environment is incomplete — ${problems.join("; ")}. See .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | null = null;

/** The checked environment of this process, read once. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
