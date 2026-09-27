// The response tags company-reach fetches (GET /api/admin/tags): which link
// each response came through, and when it started and ended. company-reach
// keeps who each code went to; this app never learns it (design §7).
// Untagged and smoke-test responses name no invitation, so they are left out.
import { SMOKE_TAG } from "@/responses";

export type TagSource = { company_uid: string | null; created_at: string; completed_at: string | null };
export type Tag = { tag: string; started_at: string; completed_at: string | null };

export function toTags(rows: TagSource[]): Tag[] {
  return rows
    .filter((row): row is TagSource & { company_uid: string } => Boolean(row.company_uid) && row.company_uid !== SMOKE_TAG)
    .map((row) => ({ tag: row.company_uid, started_at: row.created_at, completed_at: row.completed_at }));
}
