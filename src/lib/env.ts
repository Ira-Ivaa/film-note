/**
 * Validated environment access. Every variable is read through this module so
 * that a missing value fails loudly at first use instead of silently at runtime.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Paths are appended directly, so a trailing slash would double up. */
function withoutTrailingSlash(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get authSecret(): string {
    return required('AUTH_SECRET');
  },
  get tmdbAccessToken(): string | undefined {
    return optional('TMDB_ACCESS_TOKEN');
  },
  get tmdbApiKey(): string | undefined {
    return optional('TMDB_API_KEY');
  },
  /*
   * TMDB is unreachable from some networks (ISP-level blocks reset the
   * connection). These let the app be pointed at a reverse proxy or mirror
   * without code changes; the defaults are TMDB's own hosts.
   */
  get tmdbBaseUrl(): string {
    return withoutTrailingSlash(optional('TMDB_BASE_URL') ?? 'https://api.themoviedb.org/3');
  },
  get tmdbImageBase(): string {
    return withoutTrailingSlash(optional('TMDB_IMAGE_BASE') ?? 'https://image.tmdb.org/t/p');
  },
  get storageDriver(): 'local' | 'vercel-blob' {
    return optional('STORAGE_DRIVER') === 'vercel-blob' ? 'vercel-blob' : 'local';
  },
  get blobToken(): string | undefined {
    return optional('BLOB_READ_WRITE_TOKEN');
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
};

/** True when TMDB search can be performed at all. */
export const tmdbConfigured = (): boolean =>
  Boolean(env.tmdbAccessToken ?? env.tmdbApiKey);
