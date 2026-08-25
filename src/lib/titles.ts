import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

import { db } from '@/db';
import { entries, titles } from '@/db/schema';
import { fetchTmdbTitle } from '@/lib/tmdb';
import type { Title } from '@/db/schema';
import type { CustomTitleInput, TmdbRefInput } from '@/lib/validation';
import type { TmdbMediaType } from '@/lib/tmdb';

/** Reads one catalog row. */
export async function getTitle(id: string): Promise<Title | null> {
  const rows = await db.select().from(titles).where(eq(titles.id, id)).limit(1);
  return rows[0] ?? null;
}

async function findTmdbTitle(
  tmdbType: TmdbMediaType,
  tmdbId: number,
): Promise<Title | null> {
  const rows = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbType, tmdbType), eq(titles.tmdbId, tmdbId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns the catalog row for a TMDB reference, fetching and caching it on first
 * use. Returns null when TMDB has no such id.
 */
export async function importTmdbTitle(ref: TmdbRefInput): Promise<Title | null> {
  const cached = await findTmdbTitle(ref.tmdbType, ref.tmdbId);
  if (cached) return cached;

  const fetched = await fetchTmdbTitle(ref.tmdbType, ref.tmdbId);
  if (!fetched) return null;

  const inserted = await db
    .insert(titles)
    .values({
      source: 'tmdb',
      tmdbId: fetched.tmdbId,
      tmdbType: fetched.tmdbType,
      name: fetched.name,
      originalName: fetched.originalName,
      kind: ref.kind ?? fetched.kind,
      year: fetched.year,
      overview: fetched.overview,
      posterUrl: fetched.posterUrl,
      countries: fetched.countries,
    })
    // A concurrent request may have cached the same title first.
    .onConflictDoNothing()
    .returning();

  return inserted[0] ?? (await findTmdbTitle(ref.tmdbType, ref.tmdbId));
}

/** Creates a hand-written catalog row owned by the given user. */
export async function createCustomTitle(
  input: CustomTitleInput,
  createdByUserId: string,
): Promise<Title> {
  const inserted = await db
    .insert(titles)
    .values({
      source: 'custom',
      name: input.name,
      originalName: input.originalName ?? null,
      kind: input.kind,
      year: input.year ?? null,
      overview: input.overview ?? null,
      posterUrl: input.posterUrl ?? null,
      countries: input.countries,
      createdByUserId,
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new Error('Failed to insert custom title');
  return row;
}

/** Substring match over the local catalog, newest first. */
export async function searchLocalTitles(query: string, limit = 20): Promise<Title[]> {
  const pattern = `%${query}%`;
  return db
    .select()
    .from(titles)
    .where(or(ilike(titles.name, pattern), ilike(titles.originalName, pattern)))
    .orderBy(desc(titles.createdAt))
    .limit(limit);
}

/** Number of entries referencing a title; used to detect an orphaned row. */
export async function titleUsageCount(titleId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(entries)
    .where(eq(entries.titleId, titleId));
  return rows[0]?.value ?? 0;
}

/**
 * Drops a custom title once its last referencing entry is gone, so abandoned
 * hand-written rows do not accumulate. TMDB rows are kept as a shared cache.
 */
export async function deleteTitleIfOrphaned(titleId: string, userId: string): Promise<void> {
  const title = await getTitle(titleId);
  if (!title || title.source !== 'custom' || title.createdByUserId !== userId) return;
  if ((await titleUsageCount(titleId)) > 0) return;
  await db.delete(titles).where(eq(titles.id, titleId));
}
