'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ReactNode } from 'react';

/**
 * Modal shell: portal, scrim, Escape, click-outside and scroll lock in one
 * place.
 *
 * The portal is the load-bearing part. `panel` and `glass` use
 * backdrop-filter, and a filter effect makes an element a containing block for
 * its position: fixed descendants — a dialog rendered in place would be
 * positioned against the panel and clipped inside it instead of covering the
 * viewport. Every modal in the app goes through here so that trap is solved
 * once.
 */
export function Modal({
  label,
  onClose,
  children,
  width = 'max-w-2xl',
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  // `document` does not exist while this renders on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
        bg-ink/85 p-4 backdrop-blur-md max-sm:p-2.5"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`glass my-auto w-full rounded-3xl p-5 sm:p-6 max-sm:p-4 ${width}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
