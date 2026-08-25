'use client';

import { useMemo, useState } from 'react';

import { EntryEditor } from '@/components/EntryEditor';
import { TitleCard } from '@/components/TitleCard';
import { Button, EmptyState } from '@/components/ui';
import {
  KIND_LABELS,
  KIND_ORDER,
  SORT_LABELS,
  STATUS_ORDER,
  STATUS_SHORT,
} from '@/lib/labels';
import type { EntryStatus, TitleKind } from '@/db/schema';
import type { LibraryItem } from '@/lib/library';

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

    // Copy before sorting: `filter` already returns a new array, but keep this
    // explicit so the source list is never reordered in place.
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

  return (
    <div className="space-y-5">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={status === 'all' ? 'primary' : 'outline'}
          onClick={() => setStatus('all')}
        >
          Все <span className="opacity-60">{items.length}</span>
        </Button>
        {STATUS_ORDER.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'primary' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {STATUS_SHORT[value]} <span className="opacity-60">{counts.get(value) ?? 0}</span>
          </Button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input-base max-w-56"
          value={query}
          placeholder="Фильтр по названию"
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          className="input-base max-w-40"
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
          className="input-base max-w-48"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Сортировка"
        >
          {(['added', 'rating', 'name', 'year'] as const).map((value) => (
            <option key={value} value={value}>
              Сортировать по: {SORT_LABELS[value]}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-muted">
          {visible.length} из {items.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={items.length === 0 ? 'Список пуст' : 'Ничего не найдено'}>
          {items.length === 0 && !readOnly
            ? 'Найдите фильм или сериал в разделе «Поиск» и добавьте его к себе.'
            : 'Попробуйте изменить фильтры.'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {visible.map((item) => (
            <li key={item.entry.id} className="contents">
              <TitleCard
                item={item}
                onOpen={readOnly ? undefined : () => setEditingId(item.entry.id)}
              />
            </li>
          ))}
        </ul>
      )}

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
