import type { EntryStatus, ListVisibility, TitleKind } from '@/db/schema';

/** UI copy is Russian; identifiers and code stay English. */

export const KIND_LABELS: Record<TitleKind, string> = {
  movie: 'Фильм',
  series: 'Сериал',
  dorama: 'Дорама',
  anime: 'Аниме',
  cartoon: 'Мультфильм',
  other: 'Другое',
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  planned: 'Хочу посмотреть',
  watching: 'Смотрю',
  on_hold: 'Отложено',
  watched: 'Просмотрено',
  dropped: 'Брошено',
};

/** Short forms for the filter bar. */
export const STATUS_SHORT: Record<EntryStatus, string> = {
  planned: 'Хочу',
  watching: 'Смотрю',
  on_hold: 'Отложено',
  watched: 'Просмотрено',
  dropped: 'Брошено',
};

export const VISIBILITY_LABELS: Record<ListVisibility, string> = {
  private: 'Только я',
  friends: 'Друзья',
  public: 'Все',
};

export const STATUS_ORDER: EntryStatus[] = ['planned', 'watching', 'on_hold', 'watched', 'dropped'];

export const KIND_ORDER: TitleKind[] = ['movie', 'series', 'dorama', 'anime', 'cartoon', 'other'];

/** Tailwind classes per status, used for badges. */
export const STATUS_STYLES: Record<EntryStatus, string> = {
  planned: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  watching: 'bg-accent/15 text-accent border-accent/30',
  on_hold: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  watched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  dropped: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const SORT_LABELS: Record<string, string> = {
  added: 'Дате добавления',
  rating: 'Оценке',
  name: 'Названию',
  year: 'Году',
};
