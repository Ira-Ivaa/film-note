import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import { cancelRecommendation, respondToRecommendation } from '@/lib/recommendations';
import { recommendationRespondSchema } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/recommendations/:id { action } -> { action }
 *
 * Addressee only. Accepting adds the title to their own library; it never
 * overwrites an entry they already have.
 */
export async function PATCH(request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, recommendationRespondSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const result = await respondToRecommendation(auth.user.id, id, parsed.data.action);

    return result.ok
      ? ok({ action: result.action })
      : fail('not_found', 'No pending recommendation with that id');
  });
}

/** DELETE /api/recommendations/:id -> { ok }. Sender withdrawing a suggestion. */
export async function DELETE(_request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const done = await cancelRecommendation(auth.user.id, id);
    return done ? ok({ ok: true }) : fail('not_found', 'Recommendation not found');
  });
}
