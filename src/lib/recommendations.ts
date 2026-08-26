import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { entries, friendships, recommendations, titles, users } from '@/db/schema';
import { createCustomTitle, getTitle, importTmdbTitle } from '@/lib/titles';
import { TmdbError } from '@/lib/tmdb';
import type { Title, TitleKind } from '@/db/schema';
import type { RecommendationCreateInput } from '@/lib/validation';

/**
 * Suggested titles. Nothing is written into someone else's library here: a
 * recommendation is an offer, and only accepting it creates an entry. That is
 * what stops a friend from filling your list uninvited.
 */
export type RecommendationItem = {
  id: string;
  note: string | null;
  createdAt: string;
  /** The other party: sender for an inbox row, recipient for a sent one. */
  user: { id: string; username: string; displayName: string };
  title: {
    id: string;
    name: string;
    originalName: string | null;
    kind: TitleKind;
    year: number | null;
    posterUrl: string | null;
    overview: string | null;
  };
};

const SELECTION = {
  id: recommendations.id,
  note: recommendations.note,
  createdAt: recommendations.createdAt,
  userId: users.id,
  username: users.username,
  displayName: users.displayName,
  titleId: titles.id,
  name: titles.name,
  originalName: titles.originalName,
  kind: titles.kind,
  year: titles.year,
  posterUrl: titles.posterUrl,
  overview: titles.overview,
};

type Row = {
  id: string;
  note: string | null;
  createdAt: Date;
  userId: string;
  username: string;
  displayName: string;
  titleId: string;
  name: string;
  originalName: string | null;
  kind: TitleKind;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
};

function toItem(row: Row): RecommendationItem {
  return {
    id: row.id,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    user: { id: row.userId, username: row.username, displayName: row.displayName },
    title: {
      id: row.titleId,
      name: row.name,
      originalName: row.originalName,
      kind: row.kind,
      year: row.year,
      posterUrl: row.posterUrl,
      overview: row.overview,
    },
  };
}

/* ---------------------------------------------------------------- reads --- */

/** Suggestions waiting for this user's answer. */
export async function listIncomingRecommendations(
  userId: string,
): Promise<RecommendationItem[]> {
  const rows = await db
    .select(SELECTION)
    .from(recommendations)
    .innerJoin(users, eq(users.id, recommendations.fromUserId))
    .innerJoin(titles, eq(titles.id, recommendations.titleId))
    .where(and(eq(recommendations.toUserId, userId), eq(recommendations.status, 'pending')))
    .orderBy(desc(recommendations.createdAt));
  return rows.map(toItem);
}

/** Suggestions this user sent that are still unanswered. */
export async function listOutgoingRecommendations(
  userId: string,
): Promise<RecommendationItem[]> {
  const rows = await db
    .select(SELECTION)
    .from(recommendations)
    .innerJoin(users, eq(users.id, recommendations.toUserId))
    .innerJoin(titles, eq(titles.id, recommendations.titleId))
    .where(and(eq(recommendations.fromUserId, userId), eq(recommendations.status, 'pending')))
    .orderBy(desc(recommendations.createdAt));
  return rows.map(toItem);
}

/** Pending count, for the badge that makes suggestions discoverable at all. */
export async function countIncomingRecommendations(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recommendations)
    .where(and(eq(recommendations.toUserId, userId), eq(recommendations.status, 'pending')));
  return rows[0]?.count ?? 0;
}

/* --------------------------------------------------------------- writes --- */

export type SendOutcome =
  | { ok: true; sent: string[]; skipped: string[] }
  | { ok: false; reason: 'title_not_found' | 'tmdb_unavailable' | 'no_recipients' };

/**
 * Suggests one title to several friends at once.
 *
 * Only accepted friendships are written to, checked in one query in both
 * directions; anyone else in the request lands in `skipped` rather than failing
 * the whole call, so one stale handle does not lose the rest.
 */
export async function sendRecommendations(
  fromUserId: string,
  input: RecommendationCreateInput,
): Promise<SendOutcome> {
  let title: Title | null = null;

  if (input.titleId) {
    title = await getTitle(input.titleId);
  } else if (input.tmdb) {
    try {
      title = await importTmdbTitle(input.tmdb);
    } catch (error) {
      if (!(error instanceof TmdbError)) throw error;
      return { ok: false, reason: 'tmdb_unavailable' };
    }
  } else if (input.custom) {
    title = await createCustomTitle(input.custom, fromUserId);
  }

  if (!title) return { ok: false, reason: 'title_not_found' };

  // Captured before the closures below: `title` is a `let`, so TypeScript would
  // widen it back to nullable inside them.
  const titleId = title.id;
  const requested = [...new Set(input.usernames)];
  const targets = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, requested));

  const candidateIds = targets.map((t) => t.id).filter((id) => id !== fromUserId);
  // `inArray` with an empty list generates invalid SQL, so bail out first.
  if (candidateIds.length === 0) return { ok: false, reason: 'no_recipients' };

  const friendRows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          and(
            eq(friendships.requesterId, fromUserId),
            inArray(friendships.addresseeId, candidateIds),
          ),
          and(
            eq(friendships.addresseeId, fromUserId),
            inArray(friendships.requesterId, candidateIds),
          ),
        ),
      ),
    );

  const friendIds = new Set(
    friendRows.map((row) => (row.requesterId === fromUserId ? row.addresseeId : row.requesterId)),
  );

  const recipients = targets.filter((t) => friendIds.has(t.id));
  if (recipients.length === 0) return { ok: false, reason: 'no_recipients' };

  await db
    .insert(recommendations)
    .values(
      recipients.map((r) => ({
        fromUserId,
        toUserId: r.id,
        titleId,
        note: input.note ?? null,
      })),
    )
    // Re-suggesting the same title revives the row instead of stacking
    // duplicates — including one the friend had declined earlier.
    .onConflictDoUpdate({
      target: [recommendations.fromUserId, recommendations.toUserId, recommendations.titleId],
      set: {
        status: 'pending',
        note: input.note ?? null,
        createdAt: new Date(),
        respondedAt: null,
      },
    });

  const sent = recipients.map((r) => r.username);
  return { ok: true, sent, skipped: requested.filter((name) => !sent.includes(name)) };
}

export type RespondOutcome =
  | { ok: true; action: 'accepted' | 'declined' }
  | { ok: false; reason: 'not_found' };

/**
 * Accepts or declines one suggestion addressed to this user.
 *
 * Accepting inserts the entry only if there is none yet: the user may already
 * have watched and rated the title, and accepting must never reset that to
 * "planned".
 *
 * Two statements without a transaction (the Neon HTTP driver has none), ordered
 * so the worst case is harmless — if the status update fails the entry exists
 * and the row stays pending, and accepting again is idempotent.
 */
export async function respondToRecommendation(
  userId: string,
  id: string,
  action: 'accept' | 'decline',
): Promise<RespondOutcome> {
  const rows = await db
    .select({ id: recommendations.id, titleId: recommendations.titleId, fromUserId: recommendations.fromUserId })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.id, id),
        eq(recommendations.toUserId, userId),
        eq(recommendations.status, 'pending'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return { ok: false, reason: 'not_found' };

  if (action === 'accept') {
    await db
      .insert(entries)
      .values({
        userId,
        titleId: row.titleId,
        status: 'planned',
        suggestedByUserId: row.fromUserId,
      })
      .onConflictDoNothing({ target: [entries.userId, entries.titleId] });
  }

  await db
    .update(recommendations)
    .set({ status: action === 'accept' ? 'accepted' : 'declined', respondedAt: new Date() })
    .where(eq(recommendations.id, row.id));

  return { ok: true, action: action === 'accept' ? 'accepted' : 'declined' };
}

/** The sender withdrawing a suggestion that has not been answered yet. */
export async function cancelRecommendation(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(recommendations)
    .where(
      and(
        eq(recommendations.id, id),
        eq(recommendations.fromUserId, userId),
        eq(recommendations.status, 'pending'),
      ),
    )
    .returning({ id: recommendations.id });
  return deleted.length > 0;
}
