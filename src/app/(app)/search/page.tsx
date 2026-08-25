import { SearchPanel } from '@/components/SearchPanel';
import { requireUser } from '@/lib/auth';
import { listLibrary } from '@/lib/library';

export const metadata = { title: 'Поиск — Film Note' };

/**
 * Search page. The user's existing library is loaded server-side purely so the
 * panel can mark results that are already in the list.
 */
export default async function SearchPage() {
  const user = await requireUser();
  const items = await listLibrary(user.id, { sort: 'added' });

  const ownedKeys = items.flatMap(({ title }) => [
    `title:${title.id}`,
    ...(title.tmdbId && title.tmdbType ? [`tmdb:${title.tmdbType}:${title.tmdbId}`] : []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Поиск</h1>
        <p className="mt-1 text-sm text-muted">
          Ищите по базе TMDB — фильмы, сериалы, дорамы и аниме. Чего там нет, добавьте вручную
          с фотографией постера.
        </p>
      </div>

      <SearchPanel ownedKeys={ownedKeys} />
    </div>
  );
}
