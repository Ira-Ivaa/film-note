# CLAUDE.md

Machine-readable project contract. Keep in sync with code when structure changes.

## PROJECT

- name: film-note
- purpose: personal watchlist notebook for movies / series / doramas / anime; rate watched titles; view friends' libraries
- ui_language: Russian (all user-facing strings)
- code_language: English (identifiers, comments, commits, docs)
- deploy_target: Vercel Hobby (free)

## STACK

| layer | choice | version | notes |
| --- | --- | --- | --- |
| framework | Next.js App Router | 16.3.2 | React Server Components + Route Handlers |
| ui | React | 19.2.8 | |
| language | TypeScript | 5.9.3 | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| styles | Tailwind CSS | 4.3.3 | CSS-first config in `src/app/globals.css`, no `tailwind.config.js` |
| font | Onest via `next/font/google` | — | self-hosted, latin + cyrillic subsets |
| db | Neon serverless Postgres | — | free tier, autosuspends when idle |
| db client | `@neondatabase/serverless` + `drizzle-orm/neon-http` | 1.1.0 / 0.45.2 | HTTP driver |
| migrations | drizzle-kit | 0.31.10 | |
| validation | zod | 4.4.3 | |
| hashing | bcryptjs | 3.0.3 | pure JS, cost 12 |
| blob storage | `@vercel/blob` | 2.8.0 | poster photos |

No ESLint config in this repo. `tsc --noEmit` plus `next build` are the only static gates.

## COMMANDS

```
npm install
npm run dev          # localhost:3000
npm run typecheck    # tsc --noEmit          <- gate 1
npm run build        # next build            <- gate 2
npm run db:push      # sync schema to DB, no migration files (dev)
npm run db:generate  # emit SQL migration into ./drizzle
npm run db:migrate   # apply ./drizzle migrations
npm run db:studio    # drizzle-kit studio
```

Run BOTH gates after any change. Never claim completion without them.

## ENVIRONMENT

Declared and validated only in `src/lib/env.ts`. Never read `process.env` elsewhere.

| var | required | purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes | pepper for session-token SHA-256 |
| `TMDB_ACCESS_TOKEN` | no | TMDB v4 read token (preferred) |
| `TMDB_API_KEY` | no | TMDB v3 key, fallback when v4 token absent |
| `TMDB_BASE_URL` | no | override TMDB API host (reverse proxy / mirror where TMDB is blocked) |
| `TMDB_IMAGE_BASE` | no | override TMDB image host, same reason |
| `STORAGE_DRIVER` | no | `local` (default) \| `vercel-blob` |
| `BLOB_READ_WRITE_TOKEN` | prod | required when `STORAGE_DRIVER=vercel-blob` |

Without TMDB credentials the app still works: search falls back to the local catalog only, and titles are added manually.

## DIRECTORY MAP

```
src/db/schema.ts              drizzle tables, enums, inferred types  <- single source of truth
src/db/index.ts               db client (neon-http)
src/lib/env.ts                validated env access
src/lib/auth.ts               sessions, getCurrentUser, requireUser, visibility checks
src/lib/password.ts           bcrypt hash/verify/timing-decoy
src/lib/api.ts                ok / fail / readJson / parseQuery / requireApiUser / guard
src/lib/validation.ts         all zod schemas
src/lib/tmdb.ts               TMDB fetch + kind derivation
src/lib/storage.ts            poster upload (local | vercel-blob)
src/lib/titles.ts             catalog reads/writes, TMDB import, orphan pruning
src/lib/library.ts            entry queries + upsert/patch/delete, LibraryItem DTO
src/lib/friends.ts            friendship queries + mutations
src/lib/recommendations.ts    suggested titles: send / list / accept / decline
src/lib/search.ts             SearchResult / SearchResponse DTO (shared client+server)
src/lib/images.ts             poster URL mapping: TMDB -> proxy route (client-safe)
src/lib/labels.ts             Russian UI labels, status/kind ordering and styles
src/lib/theme.ts              accent + density prefs, localStorage keys, bootstrap script
src/lib/client.ts             browser fetch wrapper, ApiError
src/app/(auth)/               login, register (redirect away when signed in)
src/app/(app)/                authenticated shell; layout calls requireUser()
src/app/api/                  route handlers
src/components/               React components; 'use client' only where stateful
```

## LAYER RULES

1. Route handlers and pages contain NO SQL. Data access lives in `src/lib/{library,titles,friends,auth}.ts`.
2. Every request body is parsed with a zod schema from `src/lib/validation.ts` via `readJson`.
3. Every API response uses `ok()` / `fail()` from `src/lib/api.ts`. Error shape is always `{ error: { code, message, details? } }`. Sole exception: `/api/tmdb-image/:size/:file` serves image bytes.
4. Wrap route handler bodies in `guard(async () => ...)`.
5. Authorization: `requireApiUser()` in route handlers, `requireUser()` in Server Components, `canViewLibrary()` for another user's data.
6. Pages fetch via the `src/lib/*` functions directly (no internal HTTP to own API). Client components use `api()` from `src/lib/client.ts`.
7. Server Components never import `src/lib/client.ts`; client components never import `src/db/*` or `src/lib/{auth,storage,tmdb}.ts`.

## DATA MODEL

Tables: `users`, `sessions`, `titles`, `entries`, `friendships`, `recommendations`.

Invariants:

- `users.email` and `users.username` are stored lowercase and unique. Zod schemas lowercase them on input.
- `sessions` stores `sha256(token + AUTH_SECRET)`, never the raw token. Cookie `fn_session`, httpOnly, SameSite=Lax, 30-day TTL.
- `titles` is a shared catalog. `source='tmdb'` rows require `tmdb_id` + `tmdb_type in ('movie','tv')` and are unique on that pair (partial unique index). `source='custom'` rows require both to be NULL. Enforced by CHECK `titles_tmdb_fields_ck`.
- `entries` is unique on `(user_id, title_id)` — one entry per user per title; POST /api/entries upserts on that key.
- `entries.rating` is NULL or 1..10 (CHECK `entries_rating_ck`).
- `friendships` is one directed row with undirected meaning: `status='accepted'` in EITHER direction means friends. Always test both directions. Unique on `(requester_id, addressee_id)`; CHECK forbids self-rows.
- `titles.kind` vocabulary: `movie | series | dorama | anime | cartoon | other`. Derived from TMDB by `deriveKind()`; user may override.
- `entries.status` vocabulary: `planned | watching | on_hold | watched | dropped`.
- `users.list_visibility`: `private | friends | public`, default `friends`.
- `recommendations` is a directed offer, never a write into someone's library. Unique on `(from_user_id, to_user_id, title_id)`; re-sending revives the row (status back to `pending`) instead of stacking duplicates. CHECK forbids self-rows.
- `entries.suggested_by_user_id` records who suggested a title, set when a recommendation is accepted. Denormalised deliberately: it is a fact about how the entry came to be, and it spares every library read a join through `recommendations`. `ON DELETE SET NULL`.

## API CONTRACT

All paths under `/api`. All non-listed methods return 405 from the framework.

| method + path | auth | body / query | success |
| --- | --- | --- | --- |
| POST `/auth/register` | none | `{email,username,displayName,password}` | 201 `{user}` + cookie |
| POST `/auth/login` | none | `{email,password}` | 200 `{user}` + cookie |
| POST `/auth/logout` | none | — | 200 `{ok}` |
| GET `/auth/me` | none | — | 200 `{user\|null}` |
| GET `/titles/search` | session | `?q=&scope=all\|local` | 200 `{results,tmdbEnabled,tmdbUnavailable}` |
| POST `/titles` | session | `customTitleSchema` | 201 `{title}` |
| POST `/uploads/poster` | session | multipart, field `file` | 201 `{url}` |
| GET `/entries` | session | `?status=&kind=&q=&sort=` | 200 `{items,stats}` |
| POST `/entries` | session | `entryUpsertSchema` | 200 `{item}` |
| GET `/entries/:id` | session, owner | — | 200 `{item}` |
| PATCH `/entries/:id` | session, owner | `entryPatchSchema` | 200 `{item}` |
| DELETE `/entries/:id` | session, owner | — | 200 `{ok}` |
| GET `/friends` | session | — | 200 `{friends,incoming,outgoing}` |
| POST `/friends/requests` | session | `{username}` | 201 `{state:'pending'\|'accepted'}` |
| PATCH `/friends/requests/:id` | session, addressee | `{action:'accept'\|'decline'}` | 200 `{ok}` |
| DELETE `/friends/requests/:id` | session, either party | — | 200 `{ok}` |
| GET `/users/:username/library` | visibility-gated | `?status=&kind=&q=&sort=` | 200 `{user,items,stats}` |
| PATCH `/profile` | session | `{displayName?,listVisibility?}` | 200 `{user}` |
| GET `/recommendations` | session | — | 200 `{incoming,outgoing}` (pending only) |
| POST `/recommendations` | session | `recommendationCreateSchema` | 201 `{sent,skipped}` |
| PATCH `/recommendations/:id` | session, addressee | `{action:'accept'|'decline'}` | 200 `{action}` |
| DELETE `/recommendations/:id` | session, sender | — | 200 `{ok}` |
| GET `/tmdb-image/:size/:file` | none | — | 200 image bytes, immutable cache |

POST `/entries` carries EXACTLY ONE of `titleId` | `tmdb` | `custom` (enforced by `entryUpsertSchema.refine`).

POST `/friends/requests` auto-accepts when the target already has a pending request to the caller; response `state` distinguishes the two outcomes.

POST `/recommendations` identifies the title the same three ways as POST `/entries` (`titleId` | `tmdb` | `custom`). Non-friends in `usernames` come back in `skipped` rather than failing the call, so one stale handle does not lose the rest.

## HARD CONSTRAINTS

- **Writing into another user's library is only ever indirect.** A recommendation is an offer; `respondToRecommendation` is the single place that creates an entry for someone else, and only for the addressee themselves. Never add an endpoint that inserts into `entries` for a `user_id` other than the caller's.
- **Accepting a recommendation must NOT overwrite an existing entry.** The addressee may already have the title watched and rated; the insert uses `onConflictDoNothing` on `(user_id, title_id)`. `POST /api/entries` upserts by design — do not reuse it for accept.
- **Every modal goes through `src/components/Modal.tsx`.** It portals to `<body>`, which is required, not stylistic: see the `backdrop-filter` containing-block trap below.
- **No interactive transactions.** `drizzle-orm/neon-http` does not support them. Keep each write to one statement (`onConflictDoUpdate`). Where two writes are unavoidable (custom title + entry) an orphan catalog row is possible; `deleteTitleIfOrphaned()` cleans it up on entry delete.
- **`cookies()` and `headers()` are async** — always `await`. Cookies can be MUTATED only in Route Handlers and Server Actions, never in Server Components. `createSession` / `destroySession` therefore run only from `/api/auth/*`.
- **Dynamic route params are Promises**: `{ params }: { params: Promise<{ id: string }> }`, then `await context.params`.
- **bcrypt truncates past 72 bytes** — `passwordSchema` caps at 72 chars; do not raise it.
- **Vercel serverless request body cap is 4.5 MB** — `MAX_POSTER_BYTES` is 4 MB. Raising it requires client-side uploads (`@vercel/blob/client` + token route).
- **`STORAGE_DRIVER=local` cannot work in production** — the Vercel filesystem is read-only. Production must use `vercel-blob`.
- **Posters use plain `<img>`**, and `next.config.ts` sets `images.unoptimized`. This deliberately avoids the Hobby-tier image-transform quota. Do not switch to `next/image` without accounting for it.
- **Object names for uploads are server-generated** (`posters/<uuid>.<ext>`). Never build a storage path from client input.
- **Login must not leak account existence**: unknown email calls `burnPasswordTime()` and returns the same 401 message as a wrong password.
- Neon free tier autosuspends on idle; the first request after a pause is slow. Not a bug.
- **`titles.poster_url` stores the CANONICAL upstream URL**, including `https://image.tmdb.org/t/p/...`. The TMDB -> `/api/tmdb-image/...` rewrite happens at render time in `displayPosterUrl()`, called from the single `Poster` component. Never rewrite on write: that would need a migration and would bake the proxy into the data. A direct `image.tmdb.org` URL therefore still appears in serialized RSC payloads — that is data, not a fetched resource.
- **`/api/tmdb-image` must stay unauthenticated and strictly validated.** `<img>` cannot send auth, and a session check would kill CDN caching. `isTmdbImageRef()` is the only thing preventing an open proxy: known TMDB rendition size plus a bare content-hash file name. Do not loosen either check.
- **Every TMDB failure mode must be a `TmdbError`.** `request()` in `src/lib/tmdb.ts` wraps network faults (ISP blocks reset the connection -> `ECONNREFUSED`), non-2xx and malformed JSON, and applies an 8s `AbortSignal.timeout`. Callers catch `TmdbError` and degrade: search returns local results with `tmdbUnavailable: true`, `upsertEntry` returns `reason: 'tmdb_unavailable'` -> 502. A raw `fetch` rejection escaping to `guard()` is a bug — it becomes an opaque 500 and hides local results.

## CONVENTIONS

- Imports ordered: node builtins, external packages, `@/…` values, then `import type` lines.
- Path alias `@/*` -> `src/*`. No relative imports across top-level directories.
- Comments explain WHY (constraints, invariants), not WHAT. Match existing density.
- Prefer `type` over `interface`. Discriminated unions for results (`{ok:true,...} | {ok:false,...}`) instead of throwing across layers.
- `Record<Enum, T>` lookup maps over `switch` for label/style tables.
- Tailwind: use the `@theme` tokens (`bg-surface`, `text-muted`, `text-accent`, `border-line`) and the `glass` / `panel` / `card` / `tile` / `input-base` utilities from `globals.css`. Dark theme only — never add `dark:` or `light:` variants.
- Server Components are the default; add `'use client'` only for state, effects or event handlers.

## DESIGN SYSTEM

Dark only. There is no light theme and none is wanted: an accent that must stay
readable on both white and near-black ends up a compromise hue, and dropping
light is what lets these accents be this saturated.

- **Accent** is one of seven ids in `src/lib/theme.ts` (`gold`, `emerald`, `sapphire`, `amethyst`, `ruby`, `turquoise`, `copper`), stored in `localStorage` under `fn-accent` and applied as `data-accent` on `<html>`.
- **Overrides use `html[data-accent='…']`** (specificity 0,1,1), NOT `[data-accent]` or `:root`. Tailwind emits `@theme` values into `:root` (0,1,0); an equal-specificity selector would depend on source order, and a rebuild could silently undo all seven themes.
- **`THEME_BOOTSTRAP`** is inlined in `<head>` by the root layout and applies the stored accent before first paint. Without it every visit flashes the default gold. Keep it tiny — it is blocking script in the critical path.
- **Density** (`grid` | `list`) is stored under `fn-density`. `LibraryBrowser` starts from the default and adopts the stored value in an effect: reading `localStorage` during render would desync server and client markup.
- **Grid tiles show artwork only.** Title, meta and synopsis surface over the poster on hover / focus. Rating and favourite are the only always-on markers.
- **`@custom-variant touch (@media (hover: none))`** is how hover-only affordances declare their touch fallback — on a touch screen the tile caption stays open permanently and the synopsis is dropped. Never gate hover behaviour on viewport width: a small laptop has hover, a large tablet does not.
- **The accent appears in the layout only as the `panel` shadow** — a wide halo reading as light off the glass. Do not reintroduce a full-page gradient.
- **A `position: fixed` overlay inside `panel` / `glass` MUST be portalled to `<body>`.** `backdrop-filter` is a filter effect, and a filter effect makes the element a containing block for its fixed descendants — the overlay would position against the panel and end up clipped inside it. `EntryEditor` uses `createPortal` for exactly this reason; the mount flag is there because `document` is absent during SSR.
- **`tile` clips its children** (`overflow: hidden` keeps the poster inside the rounded corners), so its glow must be a coloured `box-shadow`; a blurred pseudo-element behind it is cut off by that same clip.
- Motion is present but restrained, and `prefers-reduced-motion` kills it globally in `globals.css`.
- Fonts must cover **Cyrillic** — the UI is Russian. Most fashionable Latin display faces (Instrument Serif, Sora, Space Grotesk) do not, and silently fall back mid-sentence. Check the Google Fonts subset list before adopting a face.

## DEPLOYMENT (all free tiers)

1. Neon: create project -> copy POOLED connection string -> `DATABASE_URL`.
2. `npm run db:generate && npm run db:migrate` (or `db:push` for a throwaway DB).
3. TMDB: account -> Settings -> API -> v4 read token -> `TMDB_ACCESS_TOKEN`.
4. Vercel: import the repo, framework auto-detected as Next.js.
5. Vercel -> Storage -> Blob -> create store, connect to project (injects `BLOB_READ_WRITE_TOKEN`); set `STORAGE_DRIVER=vercel-blob`.
6. Set `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
7. Deploy.

Alternative free hosts if Vercel is unsuitable: Cloudflare Workers (`@opennextjs/cloudflare`), Netlify, Render free web service (cold starts). Alternative free Postgres: Supabase, Xata, Aiven. Alternative free blob storage: Cloudflare R2, Supabase Storage, Cloudinary.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
