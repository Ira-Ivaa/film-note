import { fail, guard, ok, parseQuery } from '@/lib/api';
import { canViewLibrary, getCurrentUser } from '@/lib/auth';
import { getUserByUsername } from '@/lib/friends';
import { libraryStats, listLibrary } from '@/lib/library';
import { libraryQuerySchema } from '@/lib/validation';

type Context = { params: Promise<{ username: string }> };

/**
 * GET /api/users/:username/library -> { user, items, stats }
 * Enforces the owner's visibility setting: 'public' for anyone, 'friends' for
 * accepted friends, 'private' for nobody but the owner.
 */
export async function GET(request: Request, context: Context) {
  return guard(async () => {
    const viewer = await getCurrentUser();
    const { username } = await context.params;

    const target = await getUserByUsername(username);
    if (!target) return fail('not_found', 'No user with that username');

    if (!(await canViewLibrary(viewer?.id ?? null, target))) {
      return fail('forbidden', 'This library is not shared with you');
    }

    const parsed = parseQuery(request.url, libraryQuerySchema);
    if (!parsed.ok) return parsed.response;

    const [items, stats] = await Promise.all([
      listLibrary(target.id, parsed.data),
      libraryStats(target.id),
    ]);

    return ok({
      user: {
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl,
      },
      items,
      stats,
    });
  });
}
