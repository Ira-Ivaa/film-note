import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ---------------------------------------------------------------- enums --- */

/** What kind of thing is being tracked. Derived from TMDB, or picked by hand. */
export const titleKindEnum = pgEnum('title_kind', [
  'movie',
  'series',
  'dorama',
  'anime',
  'cartoon',
  'other',
]);

/** Where the metadata came from. */
export const titleSourceEnum = pgEnum('title_source', ['tmdb', 'custom']);

/** Per-user watch state of a title. */
export const entryStatusEnum = pgEnum('entry_status', [
  'planned',
  'watching',
  'on_hold',
  'watched',
  'dropped',
]);

/** Who may read a user's library. */
export const listVisibilityEnum = pgEnum('list_visibility', ['private', 'friends', 'public']);

export const friendshipStatusEnum = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'declined',
]);

/** Lifecycle of one suggested title. */
export const recommendationStatusEnum = pgEnum('recommendation_status', [
  'pending',
  'accepted',
  'declined',
]);

/* ---------------------------------------------------------------- users --- */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lowercased; unique. */
    email: text('email').notNull(),
    /** Public handle, lowercased, [a-z0-9_]{3,32}; used in /friends/<username>. */
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    listVisibility: listVisibilityEnum('list_visibility').notNull().default('friends'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_uq').on(t.email),
    uniqueIndex('users_username_uq').on(t.username),
  ],
);

/* ------------------------------------------------------------- sessions --- */

/**
 * Opaque server-side sessions. The cookie holds the raw token; only its
 * SHA-256 hash is stored, so a database leak does not yield live sessions.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uq').on(t.tokenHash),
    index('sessions_user_id_idx').on(t.userId),
  ],
);

/* --------------------------------------------------------------- titles --- */

/**
 * Shared catalog. TMDB rows are cached here on first use (one row per
 * tmdbType+tmdbId); custom rows are user-authored and readable by everyone.
 */
export const titles = pgTable(
  'titles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: titleSourceEnum('source').notNull(),
    /** null for source='custom'. */
    tmdbId: integer('tmdb_id'),
    /** TMDB media type: 'movie' | 'tv'. null for source='custom'. */
    tmdbType: text('tmdb_type'),
    name: text('name').notNull(),
    originalName: text('original_name'),
    kind: titleKindEnum('kind').notNull().default('other'),
    year: integer('year'),
    overview: text('overview'),
    /** Absolute URL: TMDB CDN, Vercel Blob, or /uploads/* in local dev. */
    posterUrl: text('poster_url'),
    /** ISO-3166-1 codes, used to tell doramas from western series. */
    countries: text('countries').array().notNull().default(sql`'{}'::text[]`),
    /** Set for source='custom'; null once the author deletes their account. */
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('titles_tmdb_uq')
      .on(t.tmdbType, t.tmdbId)
      .where(sql`${t.tmdbId} is not null`),
    index('titles_name_idx').on(t.name),
    check(
      'titles_tmdb_fields_ck',
      sql`(${t.source} = 'tmdb' and ${t.tmdbId} is not null and ${t.tmdbType} in ('movie','tv'))
          or (${t.source} = 'custom' and ${t.tmdbId} is null and ${t.tmdbType} is null)`,
    ),
  ],
);

/* -------------------------------------------------------------- entries --- */

/** One row per (user, title): the notebook entry itself. */
export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    titleId: uuid('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    status: entryStatusEnum('status').notNull().default('planned'),
    /** 1..10, null while unrated. */
    rating: smallint('rating'),
    review: text('review'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    /** Free-form progress marker, e.g. "S2E5" or "12/24". */
    progress: text('progress'),
    startedAt: date('started_at'),
    finishedAt: date('finished_at'),
    /**
     * Who suggested this title, when the entry was created by accepting a
     * recommendation. Denormalised on purpose: it is a fact about how the entry
     * came to be, and keeping it here spares every library read a join through
     * the recommendations table. Null once that account is deleted.
     */
    suggestedByUserId: uuid('suggested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('entries_user_title_uq').on(t.userId, t.titleId),
    index('entries_user_status_idx').on(t.userId, t.status),
    check('entries_rating_ck', sql`${t.rating} is null or (${t.rating} between 1 and 10)`),
  ],
);

/* ---------------------------------------------------------- friendships --- */

/**
 * Directed request row, undirected meaning: one accepted row between two users
 * means they are friends. Always compare in both directions when reading.
 */
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('friendships_pair_uq').on(t.requesterId, t.addresseeId),
    index('friendships_addressee_idx').on(t.addresseeId, t.status),
    check('friendships_no_self_ck', sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
);

/* ------------------------------------------------------- recommendations --- */

/**
 * One user suggesting one title to another. Directed and explicit: nothing is
 * written into the addressee's library until they accept, which is what keeps a
 * friend from filling your list uninvited.
 *
 * Unique per (from, to, title) so re-sending the same suggestion updates the
 * existing row instead of stacking duplicates.
 */
export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    titleId: uuid('title_id')
      .notNull()
      .references(() => titles.id, { onDelete: 'cascade' }),
    /** Optional "why you should watch this" from the sender. */
    note: text('note'),
    status: recommendationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('recommendations_triple_uq').on(t.fromUserId, t.toUserId, t.titleId),
    index('recommendations_inbox_idx').on(t.toUserId, t.status),
    check('recommendations_no_self_ck', sql`${t.fromUserId} <> ${t.toUserId}`),
  ],
);

/* ------------------------------------------------------------ relations --- */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  entries: many(entries),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  user: one(users, { fields: [entries.userId], references: [users.id] }),
  title: one(titles, { fields: [entries.titleId], references: [titles.id] }),
}));

export const titlesRelations = relations(titles, ({ many, one }) => ({
  entries: many(entries),
  createdBy: one(users, { fields: [titles.createdByUserId], references: [users.id] }),
}));

/* ---------------------------------------------------------------- types --- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Title = typeof titles.$inferSelect;
export type NewTitle = typeof titles.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Friendship = typeof friendships.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;

export type TitleKind = (typeof titleKindEnum.enumValues)[number];
export type EntryStatus = (typeof entryStatusEnum.enumValues)[number];
export type ListVisibility = (typeof listVisibilityEnum.enumValues)[number];
export type FriendshipStatus = (typeof friendshipStatusEnum.enumValues)[number];
export type RecommendationStatus = (typeof recommendationStatusEnum.enumValues)[number];
