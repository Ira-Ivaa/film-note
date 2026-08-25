import { and, eq, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entries, friendships, users } from '@/db/schema';
import type { FriendshipStatus, ListVisibility } from '@/db/schema';

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  listVisibility: ListVisibility;
};

export type FriendSummary = PublicUser & {
  entryCount: number;
  /** Id of the accepted row, needed to unfriend. */
  friendshipId: string;
};

export type FriendRequest = {
  id: string;
  status: FriendshipStatus;
  createdAt: string;
  user: PublicUser;
};

const PUBLIC_COLUMNS = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  listVisibility: users.listVisibility,
};

/** Correlated count so the friends list needs a single round trip. */
const entryCountExpr = sql<number>`(
  select count(*)::int from ${entries} where ${entries.userId} = ${users.id}
)`;

export async function getUserByUsername(username: string): Promise<PublicUser | null> {
  const rows = await db
    .select(PUBLIC_COLUMNS)
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/* ---------------------------------------------------------------- reads --- */

/**
 * Accepted friendships are stored as one directed row, so the other party is
 * whichever column is not the caller.
 */
export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const rows = await db
    .select({ ...PUBLIC_COLUMNS, entryCount: entryCountExpr, friendshipId: friendships.id })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.addresseeId)),
        and(eq(friendships.addresseeId, userId), eq(users.id, friendships.requesterId)),
      )!,
    )
    .where(eq(friendships.status, 'accepted'))
    .orderBy(users.displayName);
  return rows;
}

/** Requests waiting for the caller's decision. */
export async function listIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await db
    .select({
      // Named `requestId` so it does not collide with `users.id` in PUBLIC_COLUMNS.
      requestId: friendships.id,
      status: friendships.status,
      createdAt: friendships.createdAt,
      ...PUBLIC_COLUMNS,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, 'pending')))
    .orderBy(friendships.createdAt);
  return rows.map(shapeRequest);
}

/** Requests the caller sent that are still unanswered. */
export async function listOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await db
    .select({
      // Named `requestId` so it does not collide with `users.id` in PUBLIC_COLUMNS.
      requestId: friendships.id,
      status: friendships.status,
      createdAt: friendships.createdAt,
      ...PUBLIC_COLUMNS,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, 'pending')))
    .orderBy(friendships.createdAt);
  return rows.map(shapeRequest);
}

type RequestRow = PublicUser & {
  requestId: string;
  status: FriendshipStatus;
  createdAt: Date;
};

function shapeRequest(row: RequestRow): FriendRequest {
  const { requestId, status, createdAt, ...user } = row;
  return { id: requestId, status, createdAt: createdAt.toISOString(), user };
}

/* --------------------------------------------------------------- writes --- */

export type SendResult =
  | { ok: true; state: 'pending' | 'accepted' }
  | { ok: false; reason: 'user_not_found' | 'self' | 'already_friends' | 'already_requested' };

/**
 * Sends (or resurrects) a friend request. If the other side already has a
 * pending request out to the caller, the two are matched and become friends.
 */
export async function sendFriendRequest(userId: string, username: string): Promise<SendResult> {
  const target = await getUserByUsername(username);
  if (!target) return { ok: false, reason: 'user_not_found' };
  if (target.id === userId) return { ok: false, reason: 'self' };

  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, target.id)),
        and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, userId)),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row) {
    if (row.status === 'accepted') return { ok: false, reason: 'already_friends' };

    if (row.status === 'pending') {
      if (row.requesterId === userId) return { ok: false, reason: 'already_requested' };
      await db
        .update(friendships)
        .set({ status: 'accepted', respondedAt: new Date() })
        .where(eq(friendships.id, row.id));
      return { ok: true, state: 'accepted' };
    }

    // Previously declined: reopen it, pointing at the new requester.
    await db
      .update(friendships)
      .set({
        requesterId: userId,
        addresseeId: target.id,
        status: 'pending',
        createdAt: new Date(),
        respondedAt: null,
      })
      .where(eq(friendships.id, row.id));
    return { ok: true, state: 'pending' };
  }

  await db.insert(friendships).values({ requesterId: userId, addresseeId: target.id });
  return { ok: true, state: 'pending' };
}

/** Only the addressee may accept or decline. */
export async function respondToRequest(
  userId: string,
  requestId: string,
  action: 'accept' | 'decline',
): Promise<boolean> {
  const updated = await db
    .update(friendships)
    .set({
      status: action === 'accept' ? 'accepted' : 'declined',
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(friendships.id, requestId),
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending'),
      ),
    )
    .returning({ id: friendships.id });
  return updated.length > 0;
}

/** Withdraws a sent request or unfriends; either party may do it. */
export async function removeFriendship(userId: string, friendshipId: string): Promise<boolean> {
  const deleted = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
    .returning({ id: friendships.id });
  return deleted.length > 0;
}
