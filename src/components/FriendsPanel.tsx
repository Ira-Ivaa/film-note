'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, EmptyState, Field, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import type { FriendRequest, FriendSummary } from '@/lib/friends';

/**
 * Friend management: send a request by username, answer incoming ones, and open
 * a friend's library. Every mutation is followed by router.refresh() so the
 * server-rendered lists stay authoritative.
 */
export function FriendsPanel({
  friends,
  incoming,
  outgoing,
}: {
  friends: FriendSummary[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>, successText?: string) {
    setError(null);
    setNotice(null);
    setPendingId(id);
    try {
      await action();
      if (successText) setNotice(successText);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  }

  async function sendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handle = username.trim().toLowerCase();
    if (!handle) return;

    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const response = await api<{ state: 'pending' | 'accepted' }>('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ username: handle }),
      });
      setUsername('');
      setNotice(
        response.state === 'accepted'
          ? `Вы теперь друзья с @${handle} — заявка была встречной`
          : `Заявка отправлена @${handle}`,
      );
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={sendRequest} className="card max-w-md space-y-3 p-5">
        <Field label="Добавить друга" hint="Логин, который друг видит в своих настройках">
          <input
            className="input-base"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="lev_note"
            autoComplete="off"
            pattern="[A-Za-z0-9_]+"
            minLength={3}
            maxLength={32}
          />
        </Field>
        <Button type="submit" disabled={sending || username.trim().length < 3}>
          {sending ? <Spinner /> : null}
          Отправить заявку
        </Button>
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {incoming.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Заявки к вам ({incoming.length})
          </h2>
          <ul className="space-y-2">
            {incoming.map((request) => (
              <li key={request.id} className="card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{request.user.displayName}</p>
                  <p className="text-xs text-muted">@{request.user.username}</p>
                </div>
                <Button
                  size="sm"
                  disabled={pendingId !== null}
                  onClick={() =>
                    void run(request.id, async () => {
                      await api(`/api/friends/requests/${request.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ action: 'accept' }),
                      });
                    }, `@${request.user.username} добавлен в друзья`)
                  }
                >
                  {pendingId === request.id ? <Spinner /> : null}
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId !== null}
                  onClick={() =>
                    void run(request.id, async () => {
                      await api(`/api/friends/requests/${request.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ action: 'decline' }),
                      });
                    })
                  }
                >
                  Отклонить
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Ваши заявки ({outgoing.length})
          </h2>
          <ul className="space-y-2">
            {outgoing.map((request) => (
              <li key={request.id} className="card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{request.user.displayName}</p>
                  <p className="text-xs text-muted">@{request.user.username} · ожидает ответа</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId !== null}
                  onClick={() =>
                    void run(request.id, async () => {
                      await api(`/api/friends/requests/${request.id}`, { method: 'DELETE' });
                    })
                  }
                >
                  {pendingId === request.id ? <Spinner /> : null}
                  Отменить
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Друзья ({friends.length})
        </h2>

        {friends.length === 0 ? (
          <EmptyState title="Пока никого">
            Спросите логин у друга и отправьте заявку — после подтверждения увидите его список.
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {friends.map((friend) => (
              <li key={friend.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/friends/${friend.username}`}
                    className="font-medium hover:text-accent"
                  >
                    {friend.displayName}
                  </Link>
                  <p className="text-xs text-muted">
                    @{friend.username} · {friend.entryCount} в списке
                  </p>
                </div>
                <Link
                  href={`/friends/${friend.username}`}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs transition hover:bg-surface-3"
                >
                  Открыть список
                </Link>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pendingId !== null}
                  title="Удалить из друзей"
                  onClick={() =>
                    void run(friend.friendshipId, async () => {
                      await api(`/api/friends/requests/${friend.friendshipId}`, {
                        method: 'DELETE',
                      });
                    })
                  }
                >
                  {pendingId === friend.friendshipId ? <Spinner /> : '✕'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
