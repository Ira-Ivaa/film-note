import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Film Note — блокнот для фильмов и сериалов',
  description:
    'Список желаемого, оценки просмотренного и библиотеки друзей: фильмы, сериалы, дорамы и аниме.',
};

export const viewport: Viewport = {
  themeColor: '#07070a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
