'use client';

import { useEffect, useMemo, useState } from 'react';

import { EntryEditor } from '@/components/EntryEditor';
import { LibraryRow } from '@/components/LibraryRow';
import { TitleCard } from '@/components/TitleCard';
import { EmptyState } from '@/components/ui';
import {
  KIND_LABELS,
  KIND_ORDER,
  SORT_LABELS,
  STATUS_ORDER,
  STATUS_SHORT,
} from '@/lib/labels';
import { DEFAULT_DENSITY, DENSITY_KEY, readDensity, store } from '@/lib/theme';
import type { EntryStatus, TitleKind } from '@/db/schema';
import type { LibraryItem } from '@/lib/library';
import type { Density } from '@/lib/theme';

type SortKey = 'added' | 'rating' | 'name' | 'year';

const COLLATOR = new Intl.Collator('ru');

/**
 * Filters, sorts and renders a library. The whole list arrives from the server
 * in one payload, so every filter is applied client-side without a round trip.
 *
 * `readOnly` renders a friend's library: no editing, no delete.
 */
export function LibraryBrowser({
  items: initialItems,
  readOnly = false,
}: {
  items: LibraryItem[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<EntryStatus | 'all'>('all');
  const [kind, setKind] = useState<TitleKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('added');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Starts at the default and adopts the stored value after mount: reading
  // localStorage during render would make the server and client markup differ.
  const [density, setDensity] = useState<Density>(DEFAULT_DENSITY);
  useEffect(() => setDensity(readDensity()), []);

  function changeDensity(next: Density) {
    setDensity(next);
    store(DENSITY_KEY, next);
  }

  const counts = useMemo(() => {
    const result = new Map<EntryStatus, number>();
    for (const item of items) {
      result.set(item.entry.status, (result.get(item.entry.status) ?? 0) + 1);
    }
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (status !== 'all' && item.entry.status !== status) return false;
      if (kind !== 'all' && item.title.kind !== kind) return false;
      if (!needle) return true;
      return (
        item.title.name.toLowerCase().includes(needle) ||
        (item.title.originalName?.toLowerCase().includes(needle) ?? false)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'rating':
          return (b.entry.rating ?? -1) - (a.entry.rating ?? -1);
        case 'name':
          return COLLATOR.compare(a.title.name, b.title.name);
        case 'year':
          return (b.title.year ?? -1) - (a.title.year ?? -1);
        default:
          return b.entry.createdAt.localeCompare(a.entry.createdAt);
      }
    });
  }, [items, status, kind, query, sort]);

  const editing = editingId ? items.find((item) => item.entry.id === editingId) : undefined;
  const chip =
    'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition hover:-translate-y-px hover:text-fg';

  return (
    <div className="panel p-4 sm:p-5">
      {/* Status filters: a swipeable row on phones, where five chips will not
          wrap into anything readable. */}
      <div className="scroll-row -mx-1 flex gap-1.5 px-1 pb-1">
        <button
          type="button"
          onClick={() => setStatus('all')}
          className={`${chip} ${
            status === 'all' ? 'bg-accent font-medium text-accent-fg' : 'bg-fg/7 text-muted'
          }`}
        >
          Все · {items.length}
        </button>
        {STATUS_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`${chip} ${
              status === value ? 'bg-accent font-medium text-accent-fg' : 'bg-fg/7 text-muted'
            }`}
          >
            {STATUS_SHORT[value]} · {counts.get(value) ?? 0}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="input-base input-base-hover max-w-52"
          value={query}
          placeholder="Фильтр по названию"
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          className="input-base input-base-hover max-w-36"
          value={kind}
          onChange={(event) => setKind(event.target.value as TitleKind | 'all')}
          aria-label="Тип"
        >
          <option value="all">Все типы</option>
          {KIND_ORDER.map((value) => (
            <option key={value} value={value}>
              {KIND_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          className="input-base input-base-hover max-w-44"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Сортировка"
        >
          {(['added', 'rating', 'name', 'year'] as const).map((value) => (
            <option key={value} value={value}>
              По: {SORT_LABELS[value]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted max-sm:hidden">
            {visible.length} из {items.length}
          </span>
          <div
            role="group"
            aria-label="Вид списка"
            className="flex items-center gap-0.5 rounded-full border border-line bg-surface-2/80 p-1"
          >
            {(
              [
                { value: 'grid', label: '▦', title: 'Сетка' },
                { value: 'list', label: '☰', title: 'Список' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.title}
                aria-label={option.title}
                aria-pressed={density === option.value}
                onClick={() => changeDensity(option.value)}
                className={`rounded-full px-2.5 py-1 text-sm transition ${
                  density === option.value
                    ? 'bg-accent text-accent-fg'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {visible.length === 0 ? (
          <EmptyState title={items.length === 0 ? 'Список пуст' : 'Ничего не найдено'}>
            {items.length === 0 && !readOnly
              ? 'Найдите фильм или сериал в разделе «Поиск» и добавьте его к себе.'
              : 'Попробуйте изменить фильтры.'}
          </EmptyState>
        ) : density === 'grid' ? (
          <ul
            className="grid grid-cols-2 gap-3 min-[30rem]:grid-cols-3 sm:grid-cols-4
              lg:grid-cols-5 xl:grid-cols-6"
          >
            {visible.map((item) => (
              <li key={item.entry.id} className="contents">
                <TitleCard
                  item={item}
                  onOpen={readOnly ? undefined : () => setEditingId(item.entry.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-3">
            {visible.map((item) => (
              <li key={item.entry.id} className="contents">
                <LibraryRow
                  item={item}
                  onOpen={readOnly ? undefined : () => setEditingId(item.entry.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <EntryEditor
          item={editing}
          onClose={() => setEditingId(null)}
          onSaved={(updated) =>
            setItems((current) =>
              current.map((item) => (item.entry.id === updated.entry.id ? updated : item)),
            )
          }
          onDeleted={(entryId) =>
            setItems((current) => current.filter((item) => item.entry.id !== entryId))
          }
        />
      ) : null}
    </div>
  );
}
