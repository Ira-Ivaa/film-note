import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LibraryBrowser } from '@/components/LibraryBrowser';
import { EmptyState } from '@/components/ui';
import { canViewLibrary, requireUser } from '@/lib/auth';
import { getUserByUsername } from '@/lib/friends';
import { listLibrary } from '@/lib/library';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `@${username} — Film Note` };
}

/** A friend's library, read-only, gated by their visibility setting. */
export default async function FriendLibraryPage({ params }: Props) {
  const viewer = await requireUser();
  const { username } = await params;

  const target = await getUserByUsername(username);
  if (!target) notFound();

  if (!(await canViewLibrary(viewer.id, target))) {
    return (
      <div className="space-y-6">
        <Link href="/friends" className="text-sm text-muted hover:text-fg">
          ← К друзьям
        </Link>
        <EmptyState title="Список закрыт">
          {target.displayName} не открывает свою библиотеку. Отправьте заявку в друзья или
          попросите изменить настройку доступа.
        </EmptyState>
      </div>
    );
  }

  const items = await listLibrary(target.id, { sort: 'added' });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/friends" className="text-sm text-muted hover:text-fg">
          ← К друзьям
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight max-sm:text-2xl">{target.displayName}</h1>
        <p className="mt-1 text-sm text-muted">
          @{target.username} · {items.length} в списке · только просмотр
        </p>
      </div>

      <LibraryBrowser items={items} readOnly />
    </div>
  );
}
