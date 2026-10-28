import { env, tmdbConfigured } from '@/lib/env';
import type { TitleKind } from '@/db/schema';

const BASE = env.tmdbBaseUrl;
const IMAGE_BASE = env.tmdbImageBase;
const ANIMATION_GENRE_ID = 16;
const REQUEST_TIMEOUT_MS = 8_000;

/** TV from these origins is treated as a dorama rather than a western series. */
const DORAMA_COUNTRIES = new Set(['KR', 'CN', 'JP', 'TW', 'TH', 'HK']);

export type TmdbMediaType = 'movie' | 'tv';

export type TmdbTitle = {
  tmdbId: number;
  tmdbType: TmdbMediaType;
  name: string;
  originalName: string | null;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  countries: string[];
  kind: TitleKind;
  /** TMDB community score, 0..10; informational only. */
  voteAverage: number | null;
};

/* ------------------------------------------------------------- internals --- */

type RawResult = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  origin_country?: string[];
  original_language?: string;
  genre_ids?: number[];
  genres?: { id: number }[];
  production_countries?: { iso_3166_1: string }[];
  vote_average?: number;
};

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TmdbError';
  }
}

function authHeaders(): Record<string, string> {
  const token = env.tmdbAccessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  // v3 key is only appended when no v4 read token is configured.
  if (!env.tmdbAccessToken && env.tmdbApiKey) url.searchParams.set('api_key', env.tmdbApiKey);
  return url.toString();
}

async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!tmdbConfigured()) {
    throw new TmdbError('TMDB credentials are not configured', 501);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      headers: { accept: 'application/json', ...authHeaders() },
      // TMDB metadata is stable; cache for a day to stay well inside rate limits.
      next: { revalidate: 86_400 },
      // Where TMDB is blocked the connection is reset or black-holed; without a
      // deadline the request handler would hang on it.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Network-level failure: DNS, refused/reset connection, ISP block, timeout.
    // Wrap it so callers see one error type and can fall back to local results
    // instead of failing the whole request.
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new TmdbError(`TMDB is unreachable (${reason})`, 503, { cause });
  }

  if (!response.ok) {
    throw new TmdbError(`TMDB responded with ${response.status}`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new TmdbError('TMDB returned a malformed response', 502, { cause });
  }
}

function yearOf(raw: RawResult): number | null {
  const date = raw.release_date ?? raw.first_air_date;
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function countriesOf(raw: RawResult): string[] {
  if (raw.origin_country?.length) return raw.origin_country;
  const produced = raw.production_countries?.map((c) => c.iso_3166_1) ?? [];
  return produced.filter((code): code is string => Boolean(code));
}

function genreIdsOf(raw: RawResult): number[] {
  return raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [];
}

/**
 * Maps TMDB metadata onto our narrower vocabulary. Animation from Japan counts
 * as anime, other animation as cartoon, East/South-East Asian TV as dorama.
 * The user can always override the result.
 */
export function deriveKind(raw: RawResult, mediaType: TmdbMediaType): TitleKind {
  const countries = countriesOf(raw);
  const isJapanese = countries.includes('JP') || raw.original_language === 'ja';

  if (genreIdsOf(raw).includes(ANIMATION_GENRE_ID)) {
    return isJapanese ? 'anime' : 'cartoon';
  }
  if (mediaType === 'movie') return 'movie';
  return countries.some((code) => DORAMA_COUNTRIES.has(code)) ? 'dorama' : 'series';
}

export function posterUrl(path: string | null | undefined, size = 'w342'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

function normalize(raw: RawResult, mediaType: TmdbMediaType): TmdbTitle | null {
  if (!raw.id) return null;
  const name = raw.title ?? raw.name;
  if (!name) return null;

  return {
    tmdbId: raw.id,
    tmdbType: mediaType,
    name,
    originalName: raw.original_title ?? raw.original_name ?? null,
    year: yearOf(raw),
    overview: raw.overview?.trim() ? raw.overview.trim() : null,
    posterUrl: posterUrl(raw.poster_path),
    countries: countriesOf(raw),
    kind: deriveKind(raw, mediaType),
    voteAverage: typeof raw.vote_average === 'number' ? raw.vote_average : null,
  };
}

/* ---------------------------------------------------------------- public --- */

/** Multi-search across movies and TV, newest-relevance order as TMDB returns it. */
export async function searchTmdb(query: string, language = 'ru-RU'): Promise<TmdbTitle[]> {
  const data = await request<{ results?: RawResult[] }>('/search/multi', {
    query,
    language,
    include_adult: 'false',
    page: '1',
  });

  return (data.results ?? [])
    .filter((raw) => raw.media_type === 'movie' || raw.media_type === 'tv')
    .map((raw) => normalize(raw, raw.media_type as TmdbMediaType))
    .filter((title): title is TmdbTitle => title !== null);
}

/** Full detail lookup, used when importing a search result into the catalog. */
export async function fetchTmdbTitle(
  tmdbType: TmdbMediaType,
  tmdbId: number,
  language = 'ru-RU',
): Promise<TmdbTitle | null> {
  const raw = await request<RawResult>(`/${tmdbType}/${tmdbId}`, { language });
  return normalize(raw, tmdbType);
}
