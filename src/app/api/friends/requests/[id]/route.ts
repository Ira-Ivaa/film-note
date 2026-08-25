import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import { removeFriendship, respondToRequest } from '@/lib/friends';
import { friendRespondSchema } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/friends/requests/:id { action } -> { ok }. Addressee only. */
export async function PATCH(request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, friendRespondSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const done = await respondToRequest(auth.user.id, id, parsed.data.action);
    return done ? ok({ ok: true }) : fail('not_found', 'No pending request with that id');
  });
}

/**
 * DELETE /api/friends/requests/:id -> { ok }
 * Withdraws a sent request, rejects an incoming one, or unfriends. Either party
 * of the row may call it.
 */
export async function DELETE(_request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const done = await removeFriendship(auth.user.id, id);
    return done ? ok({ ok: true }) : fail('not_found', 'Friendship not found');
  });
}
