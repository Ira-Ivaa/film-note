'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, Poster, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS } from '@/lib/labels';
import type { RecommendationItem } from '@/lib/recommendations';

/**
 * Suggested titles: what friends sent you, and what you are still waiting on.
 *
 * Accepting adds the title to your library with a "suggested by" marker. It
 * never touches an entry you already have, so accepting something you have
 * already watched and rated will not reset it.
 */
export function RecommendationsPanel({
  incoming,
  outgoing,
}: {
  incoming: RecommendationItem[];
  outgoing: RecommendationItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {incoming.length > 0 ? (
        <section className="panel space-y-3 p-4 sm:p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Вам советуют ({incoming.length})
          </h2>

          <ul className="space-y-2">
            {incoming.map((rec) => (
              <li
                key={rec.id}
                className="flex gap-3.5 rounded-2xl border border-fg/9 bg-surface-2/50 p-3"
              >
                <Poster
                  url={rec.title.posterUrl}
                  name={rec.title.name}
                  className="aspect-2/3 w-16 shrink-0 rounded-lg shadow-md shadow-black/50"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-medium">{rec.title.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[KIND_LABELS[rec.title.kind], rec.title.year].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-xs text-accent-lift">
                    ♦ {rec.user.displayName} · @{rec.user.username}
                  </p>
                  {rec.note ? (
                    <p className="mt-1.5 text-sm leading-snug text-fg-dim">«{rec.note}»</p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={pendingId !== null}
                      onClick={() =>
                        void run(
                          rec.id,
                          async () => {
                            await api(`/api/recommendations/${rec.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ action: 'accept' }),
                            });
                          },
                          `«${rec.title.name}» добавлено в ваш список`,
                        )
                      }
                    >
                      {pendingId === rec.id ? <Spinner /> : null}
                      Добавить себе
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId !== null}
                      onClick={() =>
                        void run(rec.id, async () => {
                          await api(`/api/recommendations/${rec.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ action: 'decline' }),
                          });
                        })
                      }
                    >
                      Не интересно
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Вы посоветовали ({outgoing.length})
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {outgoing.map((rec) => (
              <li key={rec.id} className="card flex items-center gap-3 p-3">
                <Poster
                  url={rec.title.posterUrl}
                  name={rec.title.name}
                  className="aspect-2/3 w-10 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rec.title.name}</p>
                  <p className="text-xs text-muted">
                    @{rec.user.username} · ждёт ответа
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Отменить совет"
                  disabled={pendingId !== null}
                  onClick={() =>
                    void run(rec.id, async () => {
                      await api(`/api/recommendations/${rec.id}`, { method: 'DELETE' });
                    })
                  }
                >
                  {pendingId === rec.id ? <Spinner /> : '✕'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
