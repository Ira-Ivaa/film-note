import type { TitleKind } from '@/db/schema';

/**
 * One row of the unified search result set returned by
 * GET /api/titles/search. Shared by the route handler and the client panel so
 * both sides stay in step.
 */
export type SearchResult = {
  /** Stable key for React lists: `local:<uuid>` or `tmdb:<type>:<id>`. */
  key: string;
  /** Set when the title already exists in the local catalog. */
  titleId: string | null;
  tmdbId: number | null;
  tmdbType: 'movie' | 'tv' | null;
  name: string;
  originalName: string | null;
  kind: TitleKind;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  countries: string[];
};

export type SearchResponse = {
  results: SearchResult[];
  /** False when no TMDB credentials are configured on the server. */
  tmdbEnabled: boolean;
  /** True when TMDB was asked but failed; local results are still valid. */
  tmdbUnavailable: boolean;
};
