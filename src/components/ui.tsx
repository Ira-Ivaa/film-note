import type { ButtonHTMLAttributes, ReactNode } from 'react';

/*
 * Presentational primitives. No hooks and no inline handlers, so these render
 * in Server Components and are also usable from Client Components.
 */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 font-semibold',
  ghost: 'text-muted hover:text-fg hover:bg-surface-3',
  outline: 'border border-line text-fg hover:bg-surface-3',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg transition
        disabled:cursor-not-allowed disabled:opacity-50
        ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    />
  );
}

export function Badge({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]
        leading-tight whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/** Poster image with a typographic fallback when there is no artwork. */
export function Poster({
  url,
  name,
  className = '',
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-3 text-center
          text-[11px] leading-tight text-muted px-2 ${className}`}
      >
        <span className="line-clamp-4">{name}</span>
      </div>
    );
  }
  return (
    // Plain <img>: posters come pre-sized from TMDB / Blob, so next/image
    // optimization (and its Hobby transform quota) is not needed.
    <img
      src={url}
      alt={`Постер: ${name}`}
      loading="lazy"
      decoding="async"
      className={`object-cover bg-surface-3 ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  const styles =
    tone === 'error'
      ? 'border-danger/40 bg-danger/10 text-danger'
      : 'border-line bg-surface-2 text-muted';
  return (
    <p role={tone === 'error' ? 'alert' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-base font-medium">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p> : null}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3.5 animate-spin rounded-full border-2
        border-current border-t-transparent ${className}`}
    />
  );
}
