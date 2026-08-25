import { Nav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';

/** Authenticated shell: every page below this layout requires a session. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <Nav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
