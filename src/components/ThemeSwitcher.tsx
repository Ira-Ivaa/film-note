'use client';

import { useEffect, useRef, useState } from 'react';

import { ACCENTS, ACCENT_HEX, ACCENT_KEY, readAccent, store } from '@/lib/theme';
import type { Accent } from '@/lib/theme';

/**
 * One palette icon at rest; the seven colours unroll from it on hover, on
 * keyboard focus, or on tap.
 *
 * The icon itself wears the live accent, so it says both "this opens the
 * colours" and "this is the one you are on" without a second indicator.
 */
export function ThemeSwitcher() {
  const [accent, setAccent] = useState<Accent | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // The bootstrap script already set data-accent, so the first paint is right;
  // this only syncs React state with what is on the document.
  useEffect(() => setAccent(readAccent()), []);

  // Tapping opens the palette on touch, where there is no hover to rely on.
  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [open]);

  function choose(next: Accent) {
    document.documentElement.dataset.accent = next;
    store(ACCENT_KEY, next);
    setAccent(next);
    setOpen(false);
  }

  return (
    <div
      ref={root}
      data-open={open || undefined}
      className="group/palette flex items-center gap-1 rounded-full border border-line
        bg-surface-2/80 p-1 backdrop-blur"
    >
      <button
        type="button"
        aria-label="Цвет темы"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid place-items-center rounded-full p-1 text-accent transition
          group-hover/palette:-rotate-12 group-hover/palette:scale-105
          group-hover/palette:text-accent-lift"
      >
        <PaletteIcon />
      </button>

      <div
        role="group"
        aria-label="Акцентный цвет"
        className="flex max-w-0 items-center gap-0.5 overflow-hidden opacity-0
          transition-[max-width,opacity] duration-300
          group-hover/palette:max-w-56 group-hover/palette:opacity-100
          group-focus-within/palette:max-w-56 group-focus-within/palette:opacity-100
          group-data-[open]/palette:max-w-56 group-data-[open]/palette:opacity-100"
      >
        {ACCENTS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={accent === option.id}
            onClick={() => choose(option.id)}
            className="shrink-0 rounded-full p-0.5 leading-none"
          >
            <span
              style={{ background: ACCENT_HEX[option.id] }}
              className={`block size-4 rounded-full border-2 transition hover:scale-125
                ${accent === option.id ? 'border-fg' : 'border-transparent'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden focusable="false">
      <path
        d="M12 2.6c-5.2 0-9.4 4.2-9.4 9.4s4.2 9.4 9.4 9.4c1.5 0 2.5-1 2.5-2.3 0-.6-.2-1-.5-1.5
           -.3-.4-.4-.7-.4-1.1 0-.8.6-1.4 1.5-1.4h1.7c2.6 0 4.6-2 4.6-4.9 0-4.3-4.2-7.6-9.4-7.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.6" cy="9.2" r="1.35" fill="currentColor" />
      <circle cx="11.9" cy="6.9" r="1.35" fill="currentColor" />
      <circle cx="16.2" cy="9.4" r="1.35" fill="currentColor" />
      <circle cx="7.2" cy="14" r="1.35" fill="currentColor" />
    </svg>
  );
}
