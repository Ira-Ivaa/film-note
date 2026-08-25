import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';

/** Centred shell for login/register; already-signed-in users skip past it. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect('/library');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-3xl font-semibold tracking-tight">
          Film<span className="text-accent-lift">Note</span>
        </p>
      </div>
      {children}
    </main>
  );
}
