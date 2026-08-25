import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { fail, guard, ok, readJson } from '@/lib/api';
import { createSession, pruneExpiredSessions } from '@/lib/auth';
import { burnPasswordTime, verifyPassword } from '@/lib/password';
import { loginSchema } from '@/lib/validation';

/**
 * POST /api/auth/login -> 200 { user }, sets the session cookie.
 * Wrong email and wrong password are reported identically, and both paths spend
 * the same time hashing, so neither reveals whether an account exists.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const parsed = await readJson(request, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      await burnPasswordTime(password);
      return fail('unauthorized', 'Incorrect email or password');
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return fail('unauthorized', 'Incorrect email or password');
    }

    await createSession(user.id, request.headers.get('user-agent'));
    void pruneExpiredSessions().catch(() => undefined);

    return ok({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
    });
  });
}
