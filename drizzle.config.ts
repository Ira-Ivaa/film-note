import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

/*
 * drizzle-kit runs outside Next.js, so it does not inherit Next's env loading.
 * Read the same files Next does, in the same precedence order: .env.local wins
 * over .env, and dotenv never overwrites an already-set variable.
 */
config({ path: '.env.local' });
config({ path: '.env' });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Put the Neon pooled connection string in .env.local ' +
      '(see .env.example).',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
