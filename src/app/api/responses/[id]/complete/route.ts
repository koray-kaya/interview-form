// POST /api/responses/:id/complete — marks a fully answered response as
// completed and returns the reference code shown on the thank-you screen.
// Calling it twice is harmless: the second call returns the same code.
import { askedFollowUps, completeResponse, getResponse } from "@/db";
import { isUuid, json, refuseCrossSite } from "@/http";
import { fixedAnswers, isComplete, pendingFollowUps, referenceCode } from "@/responses";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const refused = refuseCrossSite(request);
  if (refused) return refused;
  const { id } = await params;
  if (!isUuid(id)) return json(404, { error: "not found" });

  const found = await getResponse(id);
  if (!found) return json(404, { error: "not found" });

  if (found.response.completed_at === null) {
    if (!isComplete(fixedAnswers(found.answers))) return json(409, { error: "questions left unanswered" });
    // a follow-up on screen is part of the form: finishing would drop it
    if (pendingFollowUps(await askedFollowUps(id), found.answers).length > 0) {
      return json(409, { error: "follow-up left unanswered" });
    }
    await completeResponse(id);
  }
  return json(200, { referenceCode: referenceCode(id) });
}
