import { guard, ok, parseQuery, requireApiUser } from '@/lib/api';
import { tmdbConfigured } from '@/lib/env';
import { TmdbError, searchTmdb } from '@/lib/tmdb';
import { searchLocalTitles } from '@/lib/titles';
import { searchQuerySchema } from '@/lib/validation';
import type { SearchResult } from '@/lib/search';

/**
 * GET /api/titles/search?q=...&scope=all|local
 *
 * Merges the local catalog with TMDB. A TMDB hit that is already cached locally
 * is returned once, carrying its local `titleId` so the client can add it
 * without a second import round trip.
 */
export async function GET(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = parseQuery(request.url, searchQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { q, scope } = parsed.data;

    const local = await searchLocalTitles(q);
    const results: SearchResult[] = [];
    const seenTmdb = new Set<string>();

    for (const title of local) {
      if (title.tmdbId && title.tmdbType) seenTmdb.add(`${title.tmdbType}:${title.tmdbId}`);
      results.push({
        key: `local:${title.id}`,
        titleId: title.id,
        tmdbId: title.tmdbId,
        tmdbType: title.tmdbType === 'movie' || title.tmdbType === 'tv' ? title.tmdbType : null,
        name: title.name,
        originalName: title.originalName,
        kind: title.kind,
        year: title.year,
        overview: title.overview,
        posterUrl: title.posterUrl,
        countries: title.countries,
      });
    }

    let tmdbUnavailable = false;
    if (scope === 'all' && tmdbConfigured()) {
      try {
        for (const hit of await searchTmdb(q)) {
          const key = `${hit.tmdbType}:${hit.tmdbId}`;
          if (seenTmdb.has(key)) continue;
          seenTmdb.add(key);
          results.push({
            key: `tmdb:${key}`,
            titleId: null,
            tmdbId: hit.tmdbId,
            tmdbType: hit.tmdbType,
            name: hit.name,
            originalName: hit.originalName,
            kind: hit.kind,
            year: hit.year,
            overview: hit.overview,
            posterUrl: hit.posterUrl,
            countries: hit.countries,
          });
        }
      } catch (error) {
        if (!(error instanceof TmdbError)) throw error;
        // A TMDB outage must not hide local results.
        console.error('[titles/search] TMDB failed', error.status, error.message);
        tmdbUnavailable = true;
      }
    }

    return ok({
      results,
      tmdbEnabled: tmdbConfigured(),
      tmdbUnavailable,
    });
  });
}
