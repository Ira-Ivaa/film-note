import { fail, guard, ok, parseQuery, readJson, requireApiUser } from '@/lib/api';
import { libraryStats, listLibrary, upsertEntry } from '@/lib/library';
import { entryUpsertSchema, libraryQuerySchema } from '@/lib/validation';

/** GET /api/entries?status=&kind=&q=&sort= -> { items, stats } for the signed-in user. */
export async function GET(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = parseQuery(request.url, libraryQuerySchema);
    if (!parsed.ok) return parsed.response;

    const [items, stats] = await Promise.all([
      listLibrary(auth.user.id, parsed.data),
      libraryStats(auth.user.id),
    ]);
    return ok({ items, stats });
  });
}

/**
 * POST /api/entries -> 200 { item }
 * Create-or-update, keyed on (user, title). The body carries exactly one of
 * `titleId` (existing catalog row), `tmdb` (import on demand) or `custom`
 * (hand-written title).
 */
export async function POST(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, entryUpsertSchema);
    if (!parsed.ok) return parsed.response;

    const result = await upsertEntry(auth.user.id, parsed.data);
    if (!result.ok) {
      return result.reason === 'tmdb_unavailable'
        ? fail('upstream_error', 'TMDB is unavailable, try again later')
        : fail('not_found', 'Title could not be resolved');
    }
    return ok({ item: result.item });
  });
}
