import { FriendsPanel } from '@/components/FriendsPanel';
import { requireUser } from '@/lib/auth';
import { listFriends, listIncomingRequests, listOutgoingRequests } from '@/lib/friends';

export const metadata = { title: 'Друзья — Film Note' };

export default async function FriendsPage() {
  const user = await requireUser();

  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    listOutgoingRequests(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Друзья</h1>
        <p className="mt-1 text-sm text-muted">
          Ваш логин для заявок: <span className="text-fg">@{user.username}</span>
        </p>
      </div>

      <FriendsPanel friends={friends} incoming={incoming} outgoing={outgoing} />
    </div>
  );
}
