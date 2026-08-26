import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';
import { countIncomingRecommendations } from '@/lib/recommendations';

/** Authenticated shell: every page below this layout requires a session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingCount = await countIncomingRecommendations(user.id);

  return (
    <div className="min-h-dvh">
      <Nav user={user} pendingCount={pendingCount} />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5 sm:py-9">{children}</main>
    </div>
  );
}
