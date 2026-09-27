// GET /api/admin/tags — for company-reach, the owner's local recruiting tool
// (#24): each tagged response's tag with its start and completion time, so
// the tool can show who answered. No answers and no other field leave here.
// Behind the admin password twice: the Proxy asks for it on /api/admin/*, and
// this route checks it again, so an edit to the matcher cannot open it.
import { adminAuthorized } from "@/admin-auth";
import { readTagSources } from "@/db";
import { json } from "@/http";
import { toTags } from "@/tags";

export async function GET(request: Request): Promise<Response> {
  if (!adminAuthorized(request.headers.get("authorization"), process.env.ADMIN_PASSWORD)) {
    return json(401, { error: "unauthorized" });
  }
  return json(200, { tags: toTags(await readTagSources()) });
}
