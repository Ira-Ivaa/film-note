import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entries, titles } from '@/db/schema';
import { createCustomTitle, importTmdbTitle } from '@/lib/titles';
import { TmdbError } from '@/lib/tmdb';
import type { Entry, EntryStatus, Title, TitleKind } from '@/db/schema';
import type { EntryPatchInput, EntryUpsertInput, LibraryQuery } from '@/lib/validation';

/** Shape returned to the client for every list row and detail view. */
export type LibraryItem = {
  entry: {
    id: string;
    status: EntryStatus;
    rating: number | null;
    review: string | null;
    progress: string | null;
    isFavorite: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  title: {
    id: string;
    source: 'tmdb' | 'custom';
    tmdbId: number | null;
    tmdbType: string | null;
    name: string;
    originalName: string | null;
    kind: TitleKind;
    year: number | null;
    overview: string | null;
    posterUrl: string | null;
    countries: string[];
  };
};

const SELECTION = {
  entryId: entries.id,
  status: entries.status,
  rating: entries.rating,
  review: entries.review,
  progress: entries.progress,
  isFavorite: entries.isFavorite,
  startedAt: entries.startedAt,
  finishedAt: entries.finishedAt,
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
  titleId: titles.id,
  source: titles.source,
  tmdbId: titles.tmdbId,
  tmdbType: titles.tmdbType,
  name: titles.name,
  originalName: titles.originalName,
  kind: titles.kind,
  year: titles.year,
  overview: titles.overview,
  posterUrl: titles.posterUrl,
  countries: titles.countries,
};

/** Flat shape returned by SELECTION; kept explicit so `toItem` is checked. */
type Row = {
  entryId: string;
  status: EntryStatus;
  rating: number | null;
  review: string | null;
  progress: string | null;
  isFavorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
  titleId: string;
  source: 'tmdb' | 'custom';
  tmdbId: number | null;
  tmdbType: string | null;
  name: string;
  originalName: string | null;
  kind: TitleKind;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  countries: string[];
};

function toItem(row: Row): LibraryItem {
  return {
    entry: {
      id: row.entryId,
      status: row.status,
      rating: row.rating,
      review: row.review,
      progress: row.progress,
      isFavorite: row.isFavorite,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    title: {
      id: row.titleId,
      source: row.source,
      tmdbId: row.tmdbId,
      tmdbType: row.tmdbType,
      name: row.name,
      originalName: row.originalName,
      kind: row.kind,
      year: row.year,
      overview: row.overview,
      posterUrl: row.posterUrl,
      countries: row.countries,
    },
  };
}

/* ---------------------------------------------------------------- reads --- */

/** One user's library, filtered and sorted. */
export async function listLibrary(
  userId: string,
  query: LibraryQuery,
): Promise<LibraryItem[]> {
  const conditions = [eq(entries.userId, userId)];
  if (query.status) conditions.push(eq(entries.status, query.status));
  if (query.kind) conditions.push(eq(titles.kind, query.kind));
  if (query.q) {
    const pattern = `%${query.q}%`;
    const match = or(ilike(titles.name, pattern), ilike(titles.originalName, pattern));
    if (match) conditions.push(match);
  }

  const orderBy = {
    added: desc(entries.createdAt),
    // Unrated rows sink to the bottom instead of leading the list.
    rating: sql`${entries.rating} desc nulls last`,
    name: asc(titles.name),
    year: sql`${titles.year} desc nulls last`,
  }[query.sort];

  const rows = await db
    .select(SELECTION)
    .from(entries)
    .innerJoin(titles, eq(titles.id, entries.titleId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(500);

  return rows.map(toItem);
}

/** A single entry belonging to the given user. */
export async function getLibraryItem(
  userId: string,
  entryId: string,
): Promise<LibraryItem | null> {
  const rows = await db
    .select(SELECTION)
    .from(entries)
    .innerJoin(titles, eq(titles.id, entries.titleId))
    .where(and(eq(entries.userId, userId), eq(entries.id, entryId)))
    .limit(1);

  const row = rows[0];
  return row ? toItem(row) : null;
}

/** Per-status counts for the library header. */
export async function libraryStats(
  userId: string,
): Promise<{ status: EntryStatus; count: number }[]> {
  const rows = await db
    .select({ status: entries.status, count: sql<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.userId, userId))
    .groupBy(entries.status);
  return rows;
}

/* --------------------------------------------------------------- writes --- */

export type UpsertOutcome =
  | { ok: true; item: LibraryItem }
  | { ok: false; reason: 'title_not_found' | 'tmdb_unavailable' };

/**
 * Resolves the target title (existing / TMDB import / hand-written) and then
 * creates or updates this user's entry for it.
 *
 * Note: the Neon HTTP driver has no interactive transactions. A custom title is
 * therefore inserted before the entry; if the entry insert then fails the
 * catalog row is left behind and cleaned up by `deleteTitleIfOrphaned`.
 */
export async function upsertEntry(
  userId: string,
  input: EntryUpsertInput,
): Promise<UpsertOutcome> {
  let title: Title | null = null;

  if (input.titleId) {
    const rows = await db.select().from(titles).where(eq(titles.id, input.titleId)).limit(1);
    title = rows[0] ?? null;
  } else if (input.tmdb) {
    try {
      title = await importTmdbTitle(input.tmdb);
    } catch (error) {
      // A blocked or failing TMDB becomes a 502 upstream_error at the route
      // boundary instead of an opaque 500.
      if (!(error instanceof TmdbError)) throw error;
      console.error('[library] TMDB import failed', error.status, error.message);
      return { ok: false, reason: 'tmdb_unavailable' };
    }
  } else if (input.custom) {
    title = await createCustomTitle(input.custom, userId);
  }

  if (!title) return { ok: false, reason: 'title_not_found' };

  const now = new Date();
  const status = input.status ?? 'planned';
  const inserted = await db
    .insert(entries)
    .values({
      userId,
      titleId: title.id,
      status,
      rating: input.rating ?? null,
      review: input.review ?? null,
      progress: input.progress ?? null,
      isFavorite: input.isFavorite ?? false,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? autoFinishedAt(status, input.finishedAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entries.userId, entries.titleId],
      set: buildPatch(input, now),
    })
    .returning({ id: entries.id });

  const entryId = inserted[0]?.id;
  if (!entryId) return { ok: false, reason: 'title_not_found' };

  const item = await getLibraryItem(userId, entryId);
  return item ? { ok: true, item } : { ok: false, reason: 'title_not_found' };
}

/** Applies a partial update to an entry the user owns. */
export async function patchEntry(
  userId: string,
  entryId: string,
  input: EntryPatchInput,
): Promise<LibraryItem | null> {
  const updated = await db
    .update(entries)
    .set(buildPatch(input, new Date()))
    .where(and(eq(entries.userId, userId), eq(entries.id, entryId)))
    .returning({ id: entries.id });

  if (!updated[0]) return null;
  return getLibraryItem(userId, entryId);
}

/** Removes an entry; returns the freed title id so the caller can prune it. */
export async function deleteEntry(
  userId: string,
  entryId: string,
): Promise<{ titleId: string } | null> {
  const deleted = await db
    .delete(entries)
    .where(and(eq(entries.userId, userId), eq(entries.id, entryId)))
    .returning({ titleId: entries.titleId });
  const row = deleted[0];
  return row ? { titleId: row.titleId } : null;
}

/* ------------------------------------------------------------- internals --- */

/** Marking something watched without a date stamps today. */
function autoFinishedAt(
  status: EntryStatus | undefined,
  explicit: string | null | undefined,
): string | null {
  if (explicit !== undefined && explicit !== null) return explicit;
  if (status !== 'watched') return null;
  return new Date().toISOString().slice(0, 10);
}

/** Only keys present in the input are written, so PATCH stays partial. */
function buildPatch(
  input: EntryPatchInput | EntryUpsertInput,
  now: Date,
): Partial<Entry> {
  const patch: Partial<Entry> = { updatedAt: now };
  if (input.status !== undefined) patch.status = input.status;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.review !== undefined) patch.review = input.review;
  if (input.progress !== undefined) patch.progress = input.progress;
  if (input.isFavorite !== undefined) patch.isFavorite = input.isFavorite;
  if (input.startedAt !== undefined) patch.startedAt = input.startedAt;
  if (input.finishedAt !== undefined) {
    patch.finishedAt = input.finishedAt;
  } else if (input.status === 'watched') {
    patch.finishedAt = new Date().toISOString().slice(0, 10);
  }
  return patch;
}
