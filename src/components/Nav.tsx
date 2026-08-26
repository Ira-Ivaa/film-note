import Link from 'next/link';

import { LogoutButton } from '@/components/LogoutButton';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { SessionUser } from '@/lib/auth';

const LINKS = [
  { href: '/library', label: 'Библиотека' },
  { href: '/search', label: 'Поиск' },
  { href: '/friends', label: 'Друзья' },
] as const;

/**
 * Floating glass pill. Stays a Server Component — active-link highlighting
 * would need usePathname, and the only interactive parts (theme, logout) are
 * their own client islands.
 *
 * On phones it stops being sticky and scrolls horizontally instead: two pinned
 * bars on a short screen eat the content, and these links will not wrap into
 * anything readable.
 */
export function Nav({
  user,
  pendingCount = 0,
}: {
  user: SessionUser;
  /** Suggestions waiting for an answer; without this badge nobody finds them. */
  pendingCount?: number;
}) {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5 sm:pt-5">
      <nav
        className="glass scroll-row flex items-center gap-0.5 rounded-full px-2 py-1.5
          sm:sticky sm:top-4 sm:z-30 sm:gap-1 sm:px-3 sm:py-2"
      >
        <Link
          href="/library"
          className="shrink-0 px-2 text-base font-bold tracking-tight sm:px-3 sm:text-lg"
        >
          Film<span className="text-accent-lift">Note</span>
        </Link>

        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted transition
              hover:bg-fg/8 hover:text-fg"
          >
            {link.label}
            {link.href === '/friends' && pendingCount > 0 ? (
              <span
                className="ml-1.5 inline-flex min-w-4.5 items-center justify-center rounded-full
                  bg-accent px-1 text-[0.65rem] font-semibold text-accent-fg"
              >
                {pendingCount}
              </span>
            ) : null}
          </Link>
        ))}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
          <ThemeSwitcher />
          <Link
            href="/settings"
            title={`${user.displayName} · @${user.username}`}
            className="hidden rounded-full px-3 py-1.5 text-sm text-muted transition
              hover:bg-fg/8 hover:text-fg sm:block"
          >
            {user.displayName}
          </Link>
          <LogoutButton />
        </div>
      </nav>
    </div>
  );
}
