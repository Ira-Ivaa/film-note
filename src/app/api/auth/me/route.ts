import { guard, ok } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

/** GET /api/auth/me -> { user } or { user: null }. Never 401, so the client can poll it. */
export async function GET() {
  return guard(async () => ok({ user: await getCurrentUser() }));
}
