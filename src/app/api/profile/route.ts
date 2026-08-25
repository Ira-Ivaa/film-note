import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { fail, guard, ok, readJson, requireApiUser } from '@/lib/api';
import { profileUpdateSchema } from '@/lib/validation';

/** PATCH /api/profile -> { user }. Display name and library visibility. */
export async function PATCH(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const parsed = await readJson(request, profileUpdateSchema);
    if (!parsed.ok) return parsed.response;

    const patch: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.displayName !== undefined) patch.displayName = parsed.data.displayName;
    if (parsed.data.listVisibility !== undefined) {
      patch.listVisibility = parsed.data.listVisibility;
    }

    const updated = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, auth.user.id))
      .returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        listVisibility: users.listVisibility,
      });

    const user = updated[0];
    return user ? ok({ user }) : fail('not_found', 'User not found');
  });
}
