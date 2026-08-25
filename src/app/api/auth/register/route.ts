import { eq, or } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { fail, guard, ok, readJson } from '@/lib/api';
import { createSession } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { registerSchema } from '@/lib/validation';

/** POST /api/auth/register -> 201 { user }, sets the session cookie. */
export async function POST(request: Request) {
  return guard(async () => {
    const parsed = await readJson(request, registerSchema);
    if (!parsed.ok) return parsed.response;
    const { email, username, displayName, password } = parsed.data;

    const clash = await db
      .select({ email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (clash[0]) {
      return fail(
        'conflict',
        clash[0].email === email ? 'Email already registered' : 'Username already taken',
      );
    }

    const passwordHash = await hashPassword(password);

    let userId: string;
    try {
      const inserted = await db
        .insert(users)
        .values({ email, username, displayName, passwordHash })
        .returning({ id: users.id });
      const row = inserted[0];
      if (!row) return fail('internal_error', 'Could not create account');
      userId = row.id;
    } catch (error) {
      // Lost a race against a concurrent signup on the same email/username.
      const message = error instanceof Error ? error.message : '';
      if (message.includes('users_email_uq')) {
        return fail('conflict', 'Email already registered');
      }
      if (message.includes('users_username_uq')) {
        return fail('conflict', 'Username already taken');
      }
      throw error;
    }

    await createSession(userId, request.headers.get('user-agent'));
    return ok({ user: { id: userId, email, username, displayName } }, 201);
  });
}
