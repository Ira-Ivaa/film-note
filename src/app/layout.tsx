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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-accent={DEFAULT_ACCENT} className={onest.variable}>
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
