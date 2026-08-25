import Link from 'next/link';

import { LibraryBrowser } from '@/components/LibraryBrowser';
import { requireUser } from '@/lib/auth';
import { listLibrary } from '@/lib/library';

export const metadata = { title: 'Моя библиотека — Film Note' };

/** The signed-in user's own list. Data is fetched server-side on every request. */
export default async function LibraryPage() {
  const user = await requireUser();
  const items = await listLibrary(user.id, { sort: 'added' });

  const watched = items.filter((item) => item.entry.status === 'watched').length;
  const rated = items.filter((item) => item.entry.rating !== null);
  const average =
    rated.length > 0
      ? (rated.reduce((sum, item) => sum + (item.entry.rating ?? 0), 0) / rated.length).toFixed(1)
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight max-sm:text-2xl">Моя библиотека</h1>
          <p className="mt-1.5 text-sm text-muted">
            Наведите на постер — покажу название и о чём это.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-2 max-sm:w-full">
          <Stat value={String(items.length)} label="всего" />
          <Stat value={String(watched)} label="просмотрено" />
          <Stat value={average} label="средняя" hero />
          <Link
            href="/search"
            className="flex items-center rounded-2xl bg-accent px-4 text-sm font-semibold
              text-accent-fg transition hover:brightness-110 max-sm:flex-1 max-sm:justify-center"
          >
            + Добавить
          </Link>
        </div>
      </div>

      <LibraryBrowser items={items} />
    </div>
  );
}

function Stat({ value, label, hero }: { value: string; label: string; hero?: boolean }) {
  return (
    <div className="glass min-w-22 rounded-2xl px-4 py-2.5 text-center max-sm:min-w-0 max-sm:flex-1">
      <b className={`block text-xl font-semibold ${hero ? 'text-accent-lift' : ''}`}>{value}</b>
      <span className="text-[0.7rem] text-muted">{label}</span>
    </div>
  );
}
