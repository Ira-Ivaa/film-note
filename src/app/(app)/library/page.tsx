import Link from 'next/link';

import { LibraryBrowser } from '@/components/LibraryBrowser';
import { requireUser } from '@/lib/auth';
import { listLibrary } from '@/lib/library';

export const metadata = { title: 'Моя библиотека — Film Note' };

/** The signed-in user's own list. Data is fetched server-side on every request. */
export default async function LibraryPage() {
  const user = await requireUser();
  const items = await listLibrary(user.id, { sort: 'added' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Моя библиотека</h1>
          <p className="mt-1 text-sm text-muted">
            Всё, что вы хотите посмотреть, смотрите и уже оценили.
          </p>
        </div>
        <Link
          href="/search"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110"
        >
          + Добавить
        </Link>
      </div>

      <LibraryBrowser items={items} />
    </div>
  );
}
