import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import {
  listIncomingRecommendations,
  listOutgoingRecommendations,
  sendRecommendations,
} from '@/lib/recommendations';
import { recommendationCreateSchema } from '@/lib/validation';

/** GET /api/recommendations -> { incoming, outgoing } (pending only). */
export async function GET() {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const [incoming, outgoing] = await Promise.all([
      listIncomingRecommendations(auth.user.id),
      listOutgoingRecommendations(auth.user.id),
    ]);

    return ok({ incoming, outgoing });
  });
}

/**
 * POST /api/recommendations -> 201 { sent, skipped }
 *
 * Suggests one title to several friends. `skipped` lists handles that were not
 * accepted friends, so one stale name does not fail the whole request.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, recommendationCreateSchema);
    if (!parsed.ok) return parsed.response;

    const result = await sendRecommendations(auth.user.id, parsed.data);
    if (result.ok) return ok({ sent: result.sent, skipped: result.skipped }, 201);

    switch (result.reason) {
      case 'tmdb_unavailable':
        return fail('upstream_error', 'TMDB is unavailable, try again later');
      case 'no_recipients':
        return fail('bad_request', 'None of those users are your friends');
      default:
        return fail('not_found', 'Title not found');
    }
  });
}
