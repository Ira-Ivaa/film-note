import { isTmdbImageRef, tmdbUpstreamUrl } from '@/lib/images';

const UPSTREAM_TIMEOUT_MS = 8_000;

/*
 * TMDB file names are content hashes, so a given URL never changes contents.
 * The long immutable TTL lets Vercel's CDN answer repeat requests without
 * invoking this function again.
 */
const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

/**
 * GET /api/tmdb-image/:size/:file
 *
 * Streams one TMDB poster through this origin, for visitors whose network
 * blocks image.tmdb.org.
 *
 * Deliberately unauthenticated: `<img>` cannot carry an auth header, and
 * requiring a session would mean a function invocation plus a session lookup
 * for every poster, defeating CDN caching. What keeps it from being an open
 * proxy is `isTmdbImageRef` — the size must be a known TMDB rendition and the
 * file name a bare content hash, so no other host or path is reachable.
 *
 * Also the one route that does not answer with `ok()` / `fail()`: it serves
 * image bytes, not the JSON envelope.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string; file: string }> },
) {
  const { size, file } = await context.params;
  if (!isTmdbImageRef(size, file)) {
    return new Response('Not found', { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(tmdbUpstreamUrl(size, file), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Blocked, refused or timed out. The poster is missing, nothing worse:
    // the Poster component renders its typographic fallback.
    return new Response('Upstream image unavailable', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream image unavailable', { status: 502 });
  }

  const contentLength = upstream.headers.get('content-length');
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'cache-control': CACHE_CONTROL,
      ...(contentLength ? { 'content-length': contentLength } : {}),
    },
  });
}
