'use client';

import { useEffect, useState } from 'react';

import { Modal } from '@/components/Modal';
import { Alert, Button, Field, Poster, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import type { EntryStatus, TitleKind } from '@/db/schema';
import type { FriendSummary } from '@/lib/friends';
import type { LibraryItem } from '@/lib/library';

/** The three ways a title can be identified, same as the entries API. */
export type TitleTarget =
  { titleId: string } | { tmdb: { tmdbId: number; tmdbType: 'movie' | 'tv'; kind?: TitleKind } };

export type TitlePreview = {
  name: string;
  posterUrl: string | null;
  kind: TitleKind;
  year: number | null;
  overview: string | null;
};

/**
 * One dialog for "add this, and maybe tell a friend about it".
 *
 * Adding to your own list writes an entry directly. Sending it to a friend does
 * not: it creates a suggestion they accept or decline, because their library is
 * theirs. Both happen in one submit so the common case is a single interaction.
 *
 * `allowSelf` is false when the caller already owns the title, which turns this
 * into a pure "recommend" dialog.
 */
export function AddTitleDialog({
  preview,
  target,
  allowSelf = true,
  onAdded,
  onDone,
  onClose,
}: {
  preview: TitlePreview;
  target: TitleTarget;
  allowSelf?: boolean;
  onAdded?: (item: LibraryItem) => void;
  onDone: (summary: string) => void;
  onClose: () => void;
}) {
  const [addSelf, setAddSelf] = useState(allowSelf);
  const [status, setStatus] = useState<EntryStatus>('planned');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const [friends, setFriends] = useState<FriendSummary[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded here rather than threaded through every page that can open this.
  useEffect(() => {
    let cancelled = false;
    api<{ friends: FriendSummary[] }>('/api/friends')
      .then((response) => {
        if (!cancelled) setFriends(response.friends);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(username: string) {
    setPicked((current) =>
      current.includes(username)
        ? current.filter((name) => name !== username)
        : [...current, username],
    );
  }

  async function submit() {
    setError(null);
    setPending(true);
    const done: string[] = [];

    try {
      if (addSelf) {
        const response = await api<{ item: LibraryItem }>('/api/entries', {
          method: 'POST',
          body: JSON.stringify({ status, ...target }),
        });
        onAdded?.(response.item);
        done.push(`добавлено вам: ${STATUS_LABELS[status].toLowerCase()}`);
      }

      if (picked.length > 0) {
        const response = await api<{ sent: string[]; skipped: string[] }>('/api/recommendations', {
          method: 'POST',
          body: JSON.stringify({
            usernames: picked,
            note: note.trim() || undefined,
            ...target,
          }),
        });
        if (response.sent.length > 0) {
          done.push(`совет отправлен: ${response.sent.map((n) => `@${n}`).join(', ')}`);
        }
        if (response.skipped.length > 0) {
          done.push(`не в друзьях: ${response.skipped.map((n) => `@${n}`).join(', ')}`);
        }
      }

      onDone(`«${preview.name}» — ${done.join('; ')}`);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  }

  const nothingChosen = !addSelf && picked.length === 0;

  return (
    <Modal label={`Добавить: ${preview.name}`} onClose={onClose} width="max-w-lg">
      <div className="flex gap-4">
        <Poster
          url={preview.posterUrl}
          name={preview.name}
          className="aspect-2/3 w-20 shrink-0 rounded-xl shadow-lg shadow-black/60 max-sm:w-16"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold">{preview.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {[KIND_LABELS[preview.kind], preview.year].filter(Boolean).join(' · ')}
          </p>
          {preview.overview ? (
            <p className="mt-1.5 line-clamp-3 text-xs leading-snug text-muted">
              {preview.overview}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
          ✕
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        {allowSelf ? (
          <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={addSelf}
                onChange={(event) => setAddSelf(event.target.checked)}
              />
              Добавить себе
            </label>

            {addSelf ? (
              <div className="mt-3">
                <Field label="Статус">
                  <select
                    className="input-base input-base-hover"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as EntryStatus)}
                  >
                    {STATUS_ORDER.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
          <p className="text-sm font-medium">Посоветовать друзьям</p>
          <p className="mt-1 text-xs text-muted">
            Друг увидит совет и сам решит, добавлять ли. В его список без подтверждения ничего не
            попадёт.
          </p>

          {friends === null ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Spinner /> Загружаю список друзей…
            </p>
          ) : friends.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Пока никого. Добавьте друга по логину в разделе «Друзья».
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {friends.map((friend) => {
                  const on = picked.includes(friend.username);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(friend.username)}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        on
                          ? 'bg-accent font-medium text-accent-fg'
                          : 'bg-fg/7 text-muted hover:text-fg'
                      }`}
                    >
                      {on ? '✓ ' : ''}
                      {friend.displayName}
                    </button>
                  );
                })}
              </div>

              {picked.length > 0 ? (
                <div className="mt-3">
                  <Field label="Записка" hint="Необязательно — зачем это смотреть">
                    <input
                      className="input-base input-base-hover"
                      value={note}
                      maxLength={500}
                      placeholder="Тебе понравится, посмотри до конца"
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </>
          )}
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={pending || nothingChosen}>
            {pending ? <Spinner /> : null}
            {addSelf && picked.length > 0
              ? 'Добавить и посоветовать'
              : picked.length > 0
                ? 'Посоветовать'
                : 'Добавить'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          {nothingChosen ? (
            <span className="text-xs text-muted">Выберите себя или хотя бы одного друга</span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
