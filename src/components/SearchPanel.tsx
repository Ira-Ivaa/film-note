'use client';

import { useState } from 'react';

import { CustomTitleForm } from '@/components/CustomTitleForm';
import { Alert, Badge, Button, EmptyState, Poster, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import type { EntryStatus } from '@/db/schema';
import type { LibraryItem } from '@/lib/library';
import type { SearchResponse, SearchResult } from '@/lib/search';

/** Membership keys let the panel mark results the user already has. */
function ownershipKeys(result: Pick<SearchResult, 'titleId' | 'tmdbId' | 'tmdbType'>): string[] {
  const keys: string[] = [];
  if (result.titleId) keys.push(`title:${result.titleId}`);
  if (result.tmdbId && result.tmdbType) keys.push(`tmdb:${result.tmdbType}:${result.tmdbId}`);
  return keys;
}

export function SearchPanel({ ownedKeys }: { ownedKeys: string[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [meta, setMeta] = useState<{ tmdbEnabled: boolean; tmdbUnavailable: boolean } | null>(null);

  const [owned, setOwned] = useState(() => new Set(ownedKeys));
  const [addStatus, setAddStatus] = useState<EntryStatus>('planned');

  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setError(null);
    setNotice(null);
    setSearching(true);
    try {
      const response = await api<SearchResponse>(
        `/api/titles/search?q=${encodeURIComponent(trimmed)}`,
      );
      setResults(response.results);
      setMeta({
        tmdbEnabled: response.tmdbEnabled,
        tmdbUnavailable: response.tmdbUnavailable,
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSearching(false);
    }
  }

  async function add(result: SearchResult) {
    setError(null);
    setNotice(null);
    setAddingKey(result.key);

    try {
      const payload = result.titleId
        ? { titleId: result.titleId, status: addStatus }
        : {
            tmdb: { tmdbId: result.tmdbId, tmdbType: result.tmdbType, kind: result.kind },
            status: addStatus,
          };

      const response = await api<{ item: LibraryItem }>('/api/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setOwned((current) => {
        const next = new Set(current);
        for (const key of ownershipKeys(result)) next.add(key);
        next.add(`title:${response.item.title.id}`);
        return next;
      });
      setNotice(`«${response.item.title.name}» добавлено: ${STATUS_LABELS[addStatus]}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <input
            className="input-base"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название фильма, сериала или дорамы"
            aria-label="Поисковый запрос"
          />
        </div>

        <select
          className="input-base max-w-52"
          value={addStatus}
          onChange={(event) => setAddStatus(event.target.value as EntryStatus)}
          aria-label="Статус для добавления"
        >
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              Добавлять как: {STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <Button type="submit" disabled={searching || query.trim().length === 0}>
          {searching ? <Spinner /> : null}
          Искать
        </Button>
        <Button type="button" variant="outline" onClick={() => setManual((value) => !value)}>
          {manual ? 'Скрыть форму' : 'Добавить вручную'}
        </Button>
      </form>

      {meta && !meta.tmdbEnabled ? (
        <Alert tone="info">
          Ключ TMDB не настроен на сервере — доступен только поиск по уже добавленным
          названиям. Добавляйте новые вручную.
        </Alert>
      ) : null}
      {meta?.tmdbUnavailable ? (
        <Alert tone="info">TMDB сейчас недоступен — показаны только локальные результаты.</Alert>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {manual ? (
        <CustomTitleForm
          onCancel={() => setManual(false)}
          onAdded={(item) => {
            setManual(false);
            setOwned((current) => new Set(current).add(`title:${item.title.id}`));
            setNotice(`«${item.title.name}» добавлено в список`);
          }}
        />
      ) : null}

      {results === null ? null : results.length === 0 ? (
        <EmptyState title="Ничего не нашлось">
          Проверьте написание или добавьте название вручную.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {results.map((result) => {
            const isOwned = ownershipKeys(result).some((key) => owned.has(key));
            return (
              <li key={result.key} className="card flex gap-3 p-3">
                <Poster
                  url={result.posterUrl}
                  name={result.name}
                  className="h-27 w-18 shrink-0 rounded-md"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{result.name}</p>
                    <Badge className="border-line bg-surface-3 text-muted">
                      {KIND_LABELS[result.kind]}
                    </Badge>
                    {result.year ? <span className="text-sm text-muted">{result.year}</span> : null}
                    {result.titleId === null ? null : (
                      <Badge className="border-line bg-surface-3 text-muted">в каталоге</Badge>
                    )}
                  </div>

                  {result.originalName && result.originalName !== result.name ? (
                    <p className="mt-0.5 text-xs text-muted">{result.originalName}</p>
                  ) : null}

                  {result.overview ? (
                    <p className="mt-1.5 line-clamp-3 text-sm text-muted">{result.overview}</p>
                  ) : null}
                </div>

                <div className="shrink-0 self-center">
                  {isOwned ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                      В списке
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      disabled={addingKey !== null}
                      onClick={() => void add(result)}
                    >
                      {addingKey === result.key ? <Spinner /> : null}
                      Добавить
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
