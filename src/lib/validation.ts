import { z } from 'zod';

import { entryStatusEnum, listVisibilityEnum, titleKindEnum } from '@/db/schema';

/* --------------------------------------------------------------- shared --- */

/** Regex-based rather than `z.email()` so the schema is zod-version agnostic. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .regex(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, 'Enter a valid email address');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'At least 3 characters')
  .max(32, 'At most 32 characters')
  .regex(/^[a-z0-9_]+$/, 'Only a-z, 0-9 and underscore');

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  // bcrypt silently truncates beyond 72 bytes; reject instead of truncating.
  .max(72, 'At most 72 characters');

export const kindSchema = z.enum(titleKindEnum.enumValues);
export const statusSchema = z.enum(entryStatusEnum.enumValues);
export const visibilitySchema = z.enum(listVisibilityEnum.enumValues);

const yearSchema = z.coerce.number().int().min(1870).max(2200);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/* -----------------------------------------------------------------­ auth --- */

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1, 'Required').max(64),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Required').max(72),
});

/* --------------------------------------------------------------- titles --- */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Query required').max(120),
  /** 'all' searches TMDB plus the local catalog; 'local' skips TMDB. */
  scope: z.enum(['all', 'local']).default('all'),
});

/** A TMDB result the client asks to import into the local catalog. */
export const tmdbRefSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  tmdbType: z.enum(['movie', 'tv']),
  /** Optional override; otherwise derived from TMDB metadata. */
  kind: kindSchema.optional(),
});

export const customTitleSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  originalName: z.string().trim().max(200).optional(),
  kind: kindSchema,
  year: yearSchema.optional(),
  overview: z.string().trim().max(4000).optional(),
  /** Returned by POST /api/uploads/poster, or a TMDB CDN URL. */
  posterUrl: z.string().trim().max(2000).optional(),
  countries: z.array(z.string().trim().length(2).toUpperCase()).max(10).default([]),
});

/* -------------------------------------------------------------- entries --- */

const entryFieldsSchema = z.object({
  status: statusSchema.optional(),
  rating: z.coerce.number().int().min(1).max(10).nullable().optional(),
  review: z.string().trim().max(8000).nullable().optional(),
  progress: z.string().trim().max(60).nullable().optional(),
  isFavorite: z.boolean().optional(),
  startedAt: isoDateSchema.nullable().optional(),
  finishedAt: isoDateSchema.nullable().optional(),
});

/**
 * Create-or-update. Exactly one of `titleId` / `tmdb` / `custom` identifies the
 * title: an existing catalog row, a TMDB result to import, or a hand-written one.
 */
export const entryUpsertSchema = entryFieldsSchema
  .extend({
    titleId: z.string().uuid().optional(),
    tmdb: tmdbRefSchema.optional(),
    custom: customTitleSchema.optional(),
  })
  .refine((v) => [v.titleId, v.tmdb, v.custom].filter(Boolean).length === 1, {
    message: 'Provide exactly one of titleId, tmdb, custom',
  });

export const entryPatchSchema = entryFieldsSchema.refine(
  (v) => Object.values(v).some((value) => value !== undefined),
  { message: 'No fields to update' },
);

export const libraryQuerySchema = z.object({
  status: statusSchema.optional(),
  kind: kindSchema.optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['added', 'rating', 'name', 'year']).default('added'),
});

/* -------------------------------------------------------------- friends --- */

export const friendRequestSchema = z.object({ username: usernameSchema });

export const friendRespondSchema = z.object({ action: z.enum(['accept', 'decline']) });

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(64).optional(),
    listVisibility: visibilitySchema.optional(),
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), {
    message: 'No fields to update',
  });

/* ------------------------------------------------------- recommendations --- */

/**
 * Suggest one title to one or more friends. The title is identified the same
 * three ways as an entry, so a search result can be recommended before it
 * exists in the local catalog.
 */
export const recommendationCreateSchema = z
  .object({
    /** Friend handles; the server verifies each friendship before writing. */
    usernames: z.array(usernameSchema).min(1, 'Pick at least one friend').max(20),
    note: z.string().trim().max(500).optional(),
    titleId: z.string().uuid().optional(),
    tmdb: tmdbRefSchema.optional(),
    custom: customTitleSchema.optional(),
  })
  .refine((v) => [v.titleId, v.tmdb, v.custom].filter(Boolean).length === 1, {
    message: 'Provide exactly one of titleId, tmdb, custom',
  });

export const recommendationRespondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

/* ---------------------------------------------------------------- types --- */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CustomTitleInput = z.infer<typeof customTitleSchema>;
export type TmdbRefInput = z.infer<typeof tmdbRefSchema>;
export type EntryUpsertInput = z.infer<typeof entryUpsertSchema>;
export type EntryPatchInput = z.infer<typeof entryPatchSchema>;
export type LibraryQuery = z.infer<typeof libraryQuerySchema>;
export type RecommendationCreateInput = z.infer<typeof recommendationCreateSchema>;
