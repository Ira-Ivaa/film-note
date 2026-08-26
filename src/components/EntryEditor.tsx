'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { RatingInput } from '@/components/RatingInput';
import { Alert, Button, Field, Poster, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import type { EntryStatus } from '@/db/schema';
import type { LibraryItem } from '@/lib/library';

/** Empty strings from date/text inputs mean "cleared", i.e. null in the API. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Modal editor for one library entry: watch status, 1..10 rating, free-form
 * review, progress marker and dates. Saves via PATCH /api/entries/:id.
 */
export function EntryEditor({
  item,
  onSaved,
  onDeleted,
  onClose,
}: {
  item: LibraryItem;
  onSaved: (item: LibraryItem) => void;
  onDeleted: (entryId: string) => void;
  onClose: () => void;
}) {
  const { entry, title } = item;

  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [rating, setRating] = useState<number | null>(entry.rating);
  const [review, setReview] = useState(entry.review ?? '');
  const [progress, setProgress] = useState(entry.progress ?? '');
  const [isFavorite, setIsFavorite] = useState(entry.isFavorite);
  const [startedAt, setStartedAt] = useState(entry.startedAt ?? '');
  const [finishedAt, setFinishedAt] = useState(entry.finishedAt ?? '');

  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * The dialog is portalled to <body>, so it needs a mount flag: `document`
   * does not exist while this renders on the server.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The page behind a modal must not scroll away under it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function save() {
    setError(null);
    setPending('save');
    try {
      const response = await api<{ item: LibraryItem }>(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          rating,
          review: orNull(review),
          progress: orNull(progress),
          isFavorite,
          startedAt: orNull(startedAt),
          finishedAt: orNull(finishedAt),
        }),
      });
      onSaved(response.item);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(null);
    }
  }

  async function remove() {
    setError(null);
    setPending('delete');
    try {
      await api(`/api/entries/${entry.id}`, { method: 'DELETE' });
      onDeleted(entry.id);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(null);
    }
  }

  if (!mounted) return null;

  /*
   * Portalled to <body> on purpose. `panel` and `glass` use backdrop-filter,
   * and a filter effect makes an element a containing block for its
   * position: fixed descendants — rendered in place, this dialog would be
   * positioned against the panel and clipped inside it instead of covering the
   * viewport.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Редактирование: ${title.name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass my-auto w-full max-w-2xl rounded-3xl p-5 sm:p-6">
        <div className="flex gap-4">
          <Poster
            url={title.posterUrl}
            name={title.name}
            className="hidden aspect-2/3 w-28 shrink-0 rounded-xl shadow-lg shadow-black/60 sm:block"
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-tight font-semibold">{title.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {[
                KIND_LABELS[title.kind],
                title.year ?? null,
                title.originalName !== title.name ? title.originalName : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {title.overview ? (
              <p className="mt-2 line-clamp-4 text-sm text-muted">{title.overview}</p>
            ) : null}
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Статус">
            <select
              className="input-base"
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

          <Field label="Прогресс" hint="Например, S2E5 или 12/24">
            <input
              className="input-base"
              value={progress}
              maxLength={60}
              onChange={(event) => setProgress(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Оценка" hint="Нажмите на выбранную цифру, чтобы снять оценку">
              <RatingInput value={rating} onChange={setRating} disabled={pending !== null} />
            </Field>
          </div>

          <Field label="Начал смотреть">
            <input
              className="input-base"
              type="date"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
            />
          </Field>

          <Field label="Закончил">
            <input
              className="input-base"
              type="date"
              value={finishedAt}
              onChange={(event) => setFinishedAt(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Заметка">
              <textarea
                className="input-base min-h-24 resize-y"
                value={review}
                maxLength={8000}
                placeholder="Что понравилось, что нет, кому советовать…"
                onChange={(event) => setReview(event.target.value)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={isFavorite}
              onChange={(event) => setIsFavorite(event.target.checked)}
            />
            Добавить в избранное
          </label>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending !== null}>
            {pending === 'save' ? <Spinner /> : null}
            Сохранить
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending !== null}>
            Отмена
          </Button>
          <Button
            variant="danger"
            className="ml-auto"
            onClick={remove}
            disabled={pending !== null}
          >
            {pending === 'delete' ? <Spinner /> : null}
            Удалить из списка
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
