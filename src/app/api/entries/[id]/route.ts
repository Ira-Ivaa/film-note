import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import { deleteEntry, getLibraryItem, patchEntry } from '@/lib/library';
import { deleteTitleIfOrphaned } from '@/lib/titles';
import { entryPatchSchema } from '@/lib/validation';

type Context = { params: Promise<{ id: string }> };

/** GET /api/entries/:id -> { item }. Own entries only. */
export async function GET(_request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const item = await getLibraryItem(auth.user.id, id);
    return item ? ok({ item }) : fail('not_found', 'Entry not found');
  });
}

/** PATCH /api/entries/:id -> { item }. Partial update of rating/status/review/... */
export async function PATCH(request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, entryPatchSchema);
    if (!parsed.ok) return parsed.response;

    const { id } = await context.params;
    const item = await patchEntry(auth.user.id, id, parsed.data);
    return item ? ok({ item }) : fail('not_found', 'Entry not found');
  });
}

/** DELETE /api/entries/:id -> { ok: true }. Prunes a now-unused custom title. */
export async function DELETE(_request: Request, context: Context) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const deleted = await deleteEntry(auth.user.id, id);
    if (!deleted) return fail('not_found', 'Entry not found');

    await deleteTitleIfOrphaned(deleted.titleId, auth.user.id);
    return ok({ ok: true });
  });
}
