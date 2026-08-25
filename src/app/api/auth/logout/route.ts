import { guard, ok } from '@/lib/api';
import { destroySession } from '@/lib/auth';

/** POST /api/auth/logout -> 200; idempotent. */
export async function POST() {
  return guard(async () => {
    await destroySession();
    return ok({ ok: true });
  });
}
