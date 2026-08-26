import { Onest } from 'next/font/google';

import { DEFAULT_ACCENT, THEME_BOOTSTRAP } from '@/lib/theme';
import type { Metadata, Viewport } from 'next';

import './globals.css';

/* Self-hosted by next/font, so no request to Google at runtime — and Onest
   ships Cyrillic, which most geometric sans on Google Fonts do not. */
const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-onest',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Film Note — блокнот для фильмов и сериалов',
  description:
    'Список желаемого, оценки просмотренного и библиотеки друзей: фильмы, сериалы, дорамы и аниме.',
};

export const viewport: Viewport = {
  themeColor: '#05050a',
  width: 'device-width',
  initialScale: 1,
};

/*
 * `suppressHydrationWarning` on <html> is required, not cosmetic:
 * THEME_BOOTSTRAP rewrites data-accent before React hydrates, so the attribute
 * React rendered (the default) and the one in the DOM (the stored accent)
 * legitimately differ. It silences warnings for this element's own attributes
 * only — one level deep, not the whole tree.
 *
 * The default stays in the JSX so the page is themed even with JS disabled.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      data-accent={DEFAULT_ACCENT}
      className={onest.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
          Applies the stored accent before first paint. Without it every visit
          flashes the default gold until the client bundle hydrates.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
