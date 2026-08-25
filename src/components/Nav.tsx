import Link from 'next/link';

import { LogoutButton } from '@/components/LogoutButton';
import type { SessionUser } from '@/lib/auth';

const LINKS = [
  { href: '/library', label: 'Моя библиотека' },
  { href: '/search', label: 'Поиск' },
  { href: '/friends', label: 'Друзья' },
];

/**
 * Top bar. Active-link highlighting is intentionally left to CSS-free simple
 * styling so this stays a Server Component (no usePathname).
 */
export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/library" className="text-lg font-semibold tracking-tight">
          Film<span className="text-accent">Note</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-2.5 py-1.5 text-muted transition hover:bg-surface-3 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-3 hover:text-fg"
          >
            {user.displayName}
            <span className="ml-1 text-xs text-muted/70">@{user.username}</span>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
