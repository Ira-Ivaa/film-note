import { guard, ok, requireApiUser } from '@/lib/api';
import { listFriends, listIncomingRequests, listOutgoingRequests } from '@/lib/friends';

/** GET /api/friends -> { friends, incoming, outgoing }. */
export async function GET() {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const [friends, incoming, outgoing] = await Promise.all([
      listFriends(auth.user.id),
      listIncomingRequests(auth.user.id),
      listOutgoingRequests(auth.user.id),
    ]);
    return ok({ friends, incoming, outgoing });
  });
}
