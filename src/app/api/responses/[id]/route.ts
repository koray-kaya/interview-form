// GET /api/responses/:id — everything the browser needs to resume: language,
// form version, whether the response is completed, and the answers so far.
// The id is the only key to a response, so a malformed one never reaches the
// database.
import { getResponse } from "@/db";
import { isUuid, json, refuseCrossSite } from "@/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const { id } = await params;
  if (!isUuid(id)) return json(404, { error: "not found" });

  const found = await getResponse(id);
  if (!found) return json(404, { error: "not found" });

  return json(200, {
    lang: found.response.lang,
    formVersion: found.response.form_version,
    completed: found.response.completed_at !== null,
    answered: found.answers.map((row) => ({
      questionId: row.question_id,
      followupIndex: row.followup_index,
      questionText: row.question_text,
      value: row.value,
    })),
  });
}
