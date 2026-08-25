import Link from 'next/link';

import { LogoutButton } from '@/components/LogoutButton';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import type { SessionUser } from '@/lib/auth';

const LINKS = [
  { href: '/library', label: 'Библиотека' },
  { href: '/search', label: 'Поиск' },
  { href: '/friends', label: 'Друзья' },
];

/**
 * Floating glass pill. Stays a Server Component — active-link highlighting
 * would need usePathname, and the only interactive parts (theme, logout) are
 * their own client islands.
 *
 * On phones it stops being sticky and scrolls horizontally instead: two pinned
 * bars on a short screen eat the content, and these links will not wrap into
 * anything readable.
 */
export function Nav({ user }: { user: SessionUser }) {
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
