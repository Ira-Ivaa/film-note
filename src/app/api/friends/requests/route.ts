import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import { sendFriendRequest } from '@/lib/friends';
import { friendRequestSchema } from '@/lib/validation';

/**
 * POST /api/friends/requests { username } -> { state: 'pending' | 'accepted' }
 * Returns 'accepted' when the other user had already requested the caller.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, friendRequestSchema);
    if (!parsed.ok) return parsed.response;

    const result = await sendFriendRequest(auth.user.id, parsed.data.username);
    if (result.ok) return ok({ state: result.state }, 201);

    switch (result.reason) {
      case 'user_not_found':
        return fail('not_found', 'No user with that username');
      case 'self':
        return fail('bad_request', 'You cannot add yourself');
      case 'already_friends':
        return fail('conflict', 'You are already friends');
      default:
        return fail('conflict', 'Request already sent');
    }
  });
}
