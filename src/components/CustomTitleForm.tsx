'use client';

import { useEffect, useRef, useState } from 'react';

import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS, KIND_ORDER, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import type { EntryStatus, TitleKind } from '@/db/schema';
import type { LibraryItem } from '@/lib/library';

const MAX_POSTER_MB = 4;

/**
 * Adds a title TMDB does not know about. The poster is a photo from the user's
 * device: it is uploaded first (POST /api/uploads/poster) and the resulting URL
 * is attached to the new catalog row.
 */
export function CustomTitleForm({
  onAdded,
  onCancel,
}: {
  onAdded: (item: LibraryItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [kind, setKind] = useState<TitleKind>('movie');
  const [year, setYear] = useState('');
  const [overview, setOverview] = useState('');
  const [status, setStatus] = useState<EntryStatus>('planned');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs must be released or the blob stays in memory for the session.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(selected: File | null) {
    setError(null);
    if (selected && selected.size > MAX_POSTER_MB * 1024 * 1024) {
      setError(`Фото больше ${MAX_POSTER_MB} МБ — выберите поменьше`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setFile(selected);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      let posterUrl: string | undefined;
      if (file) {
        const body = new FormData();
        body.append('file', file);
        const uploaded = await api<{ url: string }>('/api/uploads/poster', {
          method: 'POST',
          body,
        });
        posterUrl = uploaded.url;
      }

      const parsedYear = Number.parseInt(year, 10);
      const response = await api<{ item: LibraryItem }>('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          status,
          custom: {
            name: name.trim(),
            originalName: originalName.trim() || undefined,
            kind,
            year: Number.isFinite(parsedYear) ? parsedYear : undefined,
            overview: overview.trim() || undefined,
            posterUrl,
            countries: [],
          },
        }),
      });

      onAdded(response.item);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">Добавить вручную</h2>
        <p className="mt-1 text-sm text-muted">
          Для того, чего нет в базе TMDB. Постер можно сфотографировать или выбрать из галереи.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-2">
          <div className="flex aspect-2/3 w-32 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
            {previewUrl ? (
              <img src={previewUrl} alt="Предпросмотр постера" className="size-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs text-muted">Постер не выбран</span>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="block w-32 text-xs text-muted file:mr-2 file:rounded-md file:border-0
              file:bg-surface-3 file:px-2 file:py-1 file:text-xs file:text-fg"
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />

          {file ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null);
                if (fileInput.current) fileInput.current.value = '';
              }}
            >
              Убрать фото
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Название">
              <input
                className="input-base"
                value={name}
                required
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например, «Наш переводчик»"
              />
            </Field>
          </div>

          <Field label="Тип">
            <select
              className="input-base"
              value={kind}
              onChange={(event) => setKind(event.target.value as TitleKind)}
            >
              {KIND_ORDER.map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Год">
            <input
              className="input-base"
              value={year}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))}
              placeholder="2024"
            />
          </Field>

          <Field label="Оригинальное название">
            <input
              className="input-base"
              value={originalName}
              maxLength={200}
              onChange={(event) => setOriginalName(event.target.value)}
            />
          </Field>

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

          <div className="sm:col-span-2">
            <Field label="Описание">
              <textarea
                className="input-base min-h-20 resize-y"
                value={overview}
                maxLength={4000}
                onChange={(event) => setOverview(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || name.trim().length === 0}>
          {pending ? <Spinner /> : null}
          Добавить в список
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
