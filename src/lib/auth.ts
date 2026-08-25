import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { and, eq, gt, lt, or } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { db } from '@/db';
import { friendships, sessions, users } from '@/db/schema';
import { env } from '@/lib/env';
import type { ListVisibility } from '@/db/schema';

export const SESSION_COOKIE = 'fn_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  listVisibility: ListVisibility;
};

/** Cookie carries the raw token; only this hash is persisted. */
function hashToken(token: string): string {
  return createHash('sha256').update(`${token}:${env.authSecret}`).digest('hex');
}

/* --------------------------------------------------------------- writes --- */

/**
 * Issues a session and sets the cookie. Callable only from Route Handlers and
 * Server Actions — Server Components cannot mutate cookies.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 512) ?? null,
    expiresAt,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    expires: expiresAt,
  });
}

/** Deletes the current session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Opportunistic cleanup of expired rows; safe to call from any request. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/* ---------------------------------------------------------------- reads --- */

/**
 * Resolves the signed-in user, memoized for the lifetime of one request so that
 * several components/handlers can call it without extra round trips.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      listVisibility: users.listVisibility,
      storedHash: sessions.tokenHash,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Defence in depth: the lookup above is already exact-match, this only guards
  // against a future change that widens the query.
  const a = Buffer.from(row.storedHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const { storedHash: _ignored, ...user } = row;
  return user;
});

/** Server Component guard: redirects to /login when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/* ------------------------------------------------------------ friendship --- */

/** True when an accepted friendship row exists in either direction. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return true;
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Applies a target user's visibility setting to a given viewer. */
export async function canViewLibrary(
  viewerId: string | null,
  target: { id: string; listVisibility: ListVisibility },
): Promise<boolean> {
  if (viewerId === target.id) return true;
  if (target.listVisibility === 'public') return true;
  if (target.listVisibility === 'private') return false;
  if (!viewerId) return false;
  return areFriends(viewerId, target.id);
}
