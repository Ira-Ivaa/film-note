import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { env } from '@/lib/env';
import * as schema from './schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

type Db = NeonHttpDatabase<typeof schema>;

/**
 * Neon over HTTP: one round trip per statement, no connection pool to manage,
 * works inside Vercel serverless functions without warm-up.
 *
 * Constraint: the HTTP driver does NOT support interactive transactions. Keep
 * every write to a single statement (see `onConflictDoUpdate` usage), or accept
 * that a failed follow-up leaves the prior row in place.
 */
let instance: Db | null = null;

function connect(): Db {
  instance ??= drizzle(neon(env.databaseUrl), { schema, casing: 'snake_case' });
  return instance;
}

/**
 * Lazy handle. `next build` loads every route module to collect page data, so
 * connecting at module scope would make DATABASE_URL a build-time requirement.
 * The proxy defers that to the first actual query, which keeps builds
 * secret-free while still failing loudly at request time when unconfigured.
 */
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const real = connect();
    const value = Reflect.get(real, property, receiver);
    // Drizzle's methods rely on `this`, so rebind them to the real instance.
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export { schema };
