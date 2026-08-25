import { guard, ok, readJson, requireApiUser } from '@/lib/api';
import { createCustomTitle } from '@/lib/titles';
import { customTitleSchema } from '@/lib/validation';

/**
 * POST /api/titles -> 201 { title }
 * Creates a hand-written catalog entry for something TMDB does not have.
 * Upload the poster photo first via POST /api/uploads/poster and pass its URL.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, customTitleSchema);
    if (!parsed.ok) return parsed.response;

    const title = await createCustomTitle(parsed.data, auth.user.id);
    return ok({ title }, 201);
  });
}
