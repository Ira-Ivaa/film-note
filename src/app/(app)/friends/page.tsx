import { FriendsPanel } from '@/components/FriendsPanel';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { requireUser } from '@/lib/auth';
import { listFriends, listIncomingRequests, listOutgoingRequests } from '@/lib/friends';
import {
  listIncomingRecommendations,
  listOutgoingRecommendations,
} from '@/lib/recommendations';

export const metadata = { title: 'Друзья — Film Note' };

export default async function FriendsPage() {
  const user = await requireUser();

  const [friends, incoming, outgoing, suggestedToMe, suggestedByMe] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    listOutgoingRequests(user.id),
    listIncomingRecommendations(user.id),
    listOutgoingRecommendations(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h1 className="text-3xl font-semibold tracking-tight max-sm:text-2xl">Друзья</h1>
        <p className="mt-1.5 text-sm text-muted">
          Ваш логин для заявок: <span className="text-fg">@{user.username}</span>
        </p>
      </div>

      {/* Suggestions first: they are the only thing here that waits on you. */}
      <RecommendationsPanel incoming={suggestedToMe} outgoing={suggestedByMe} />

      <FriendsPanel friends={friends} incoming={incoming} outgoing={outgoing} />
    </div>
  );
}
