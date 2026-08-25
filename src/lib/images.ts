/**
 * Poster URL mapping, shared by the proxy route and the client components.
 *
 * TMDB artwork lives on image.tmdb.org, which the *browser* fetches directly.
 * Where an ISP blocks that host the images simply never load, and no amount of
 * server-side configuration helps. So TMDB URLs are rewritten to a same-origin
 * route that fetches the file server-side and streams it back.
 *
 * Client-safe on purpose: no server-only imports here.
 */

const TMDB_IMAGE_PREFIX = 'https://image.tmdb.org/t/p/';

/** The rendition sizes TMDB serves. Anything else the proxy rejects. */
const TMDB_IMAGE_SIZES = new Set(['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original']);

/** TMDB file names are content hashes plus an extension — nothing else. */
const TMDB_FILE_NAME = /^[A-Za-z0-9]+\.(jpg|jpeg|png|webp)$/;

/**
 * Guard for the proxy route. Keeping this strict is what stops the route from
 * being a general-purpose open proxy: it can only ever reach TMDB renditions.
 */
export function isTmdbImageRef(size: string, file: string): boolean {
  return TMDB_IMAGE_SIZES.has(size) && TMDB_FILE_NAME.test(file);
}

export function tmdbUpstreamUrl(size: string, file: string): string {
  return `${TMDB_IMAGE_PREFIX}${size}/${file}`;
}

/**
 * Maps a stored poster URL to the URL the browser should request. Uploaded
 * posters (Vercel Blob or local `/uploads`) pass through untouched; TMDB
 * artwork is routed through the proxy.
 *
 * Note that `titles.poster_url` keeps the canonical upstream URL. Rewriting at
 * render time means no migration for rows already in the catalog, and removing
 * the proxy later needs no data change either.
 */
export function displayPosterUrl(url: string | null): string | null {
  if (!url || !url.startsWith(TMDB_IMAGE_PREFIX)) return url;

  const [size, file, ...rest] = url.slice(TMDB_IMAGE_PREFIX.length).split('/');
  if (!size || !file || rest.length > 0 || !isTmdbImageRef(size, file)) return url;

  return `/api/tmdb-image/${size}/${file}`;
}
