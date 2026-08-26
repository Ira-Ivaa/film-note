'use client';

import { useState } from 'react';

import { AddTitleDialog } from '@/components/AddTitleDialog';
import { CustomTitleForm } from '@/components/CustomTitleForm';
import { Alert, Badge, Button, EmptyState, Poster, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { KIND_LABELS } from '@/lib/labels';
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
  const [meta, setMeta] = useState<{ tmdbEnabled: boolean; tmdbUnavailable: boolean } | null>(
    null,
  );

  const [owned, setOwned] = useState(() => new Set(ownedKeys));
  /** The result whose add dialog is open. */
  const [adding, setAdding] = useState<SearchResult | null>(null);

  const [searching, setSearching] = useState(false);
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

  return (
    <div className="panel space-y-5 p-4 sm:p-5">
      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <input
            className="input-base input-base-hover"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название фильма, сериала или дорамы"
            aria-label="Поисковый запрос"
          />
        </div>

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
          Ключ TMDB не настроен на сервере — доступен только поиск по уже добавленным названиям.
          Добавляйте новые вручную.
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
              <li
                key={result.key}
                className="flex gap-4 rounded-3xl border border-fg/9 bg-surface/58 p-3.5
                  backdrop-blur-lg transition hover:border-accent/40 max-sm:gap-3 max-sm:p-3"
              >
                <Poster
                  url={result.posterUrl}
                  name={result.name}
                  className="aspect-2/3 w-20 shrink-0 rounded-xl shadow-lg shadow-black/60
                    max-sm:w-14"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{result.name}</p>
                    <Badge className="bg-fg/8 text-muted">{KIND_LABELS[result.kind]}</Badge>
                    {result.year ? (
                      <span className="text-sm text-muted">{result.year}</span>
                    ) : null}
                  </div>

                  {result.originalName && result.originalName !== result.name ? (
                    <p className="mt-0.5 text-xs text-muted">{result.originalName}</p>
                  ) : null}

                  {result.overview ? (
                    <p className="mt-1.5 line-clamp-3 text-sm text-muted max-sm:line-clamp-2">
                      {result.overview}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 self-center">
                  {isOwned ? (
                    <Badge className="bg-accent/18 text-accent-lift">В списке</Badge>
                  ) : (
                    <Button size="sm" onClick={() => setAdding(result)}>
                      Добавить
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <AddTitleDialog
          preview={{
            name: adding.name,
            posterUrl: adding.posterUrl,
            kind: adding.kind,
            year: adding.year,
            overview: adding.overview,
          }}
          // An existing catalog row is referenced by id; a fresh TMDB hit is
          // imported by the server on submit.
          target={
            adding.titleId
              ? { titleId: adding.titleId }
              : {
                  tmdb: {
                    tmdbId: adding.tmdbId as number,
                    tmdbType: adding.tmdbType as 'movie' | 'tv',
                    kind: adding.kind,
                  },
                }
          }
          onAdded={(item) => {
            setOwned((current) => {
              const next = new Set(current);
              for (const key of ownershipKeys(adding)) next.add(key);
              next.add(`title:${item.title.id}`);
              return next;
            });
          }}
          onDone={setNotice}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  );
}
