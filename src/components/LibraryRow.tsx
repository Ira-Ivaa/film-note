import { Poster } from '@/components/ui';
import { KIND_LABELS, STATUS_LABELS } from '@/lib/labels';
import type { LibraryItem } from '@/lib/library';

/**
 * List row: a roomy plaque. The poster is deliberately large — a thumbnail the
 * size of a favicon tells you nothing, and the point of this mode is seeing
 * your own note and progress without opening anything.
 *
 * Shows the note when there is one and falls back to the synopsis, since your
 * own words about a title are worth more than the distributor's.
 */
export function LibraryRow({ item, onOpen }: { item: LibraryItem; onOpen?: () => void }) {
  const { entry, title } = item;

  const body = (
    <>
      <Poster
        url={title.posterUrl}
        name={title.name}
        className="aspect-2/3 w-full rounded-xl shadow-lg shadow-black/60"
      />

      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg leading-tight font-semibold tracking-tight max-sm:text-base">
            {title.name}
          </span>
          {entry.isFavorite ? (
            <span title="В избранном" className="text-sm text-accent-lift">
              ♥
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block text-sm text-muted max-sm:text-xs">
          {[
            title.originalName !== title.name ? title.originalName : null,
            KIND_LABELS[title.kind],
            title.year,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent/18 px-2.5 py-0.5 text-xs text-accent-lift">
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.progress ? (
            <span className="rounded-full bg-fg/8 px-2.5 py-0.5 text-xs text-muted">
              {entry.progress}
            </span>
          ) : null}
        </span>

        {(entry.review ?? title.overview) ? (
          <span
            className="mt-2 block line-clamp-3 max-w-[62ch] text-sm leading-relaxed text-fg-dim
              max-sm:text-xs"
          >
            {entry.review ? `«${entry.review}»` : title.overview}
          </span>
        ) : null}
      </span>

      {/* On a phone the score drops under the poster: sharing a cell with the
          text would let a long synopsis run beneath it. */}
      <span
        className={`grid min-h-14 min-w-14 place-items-center rounded-2xl border text-2xl
          leading-none font-semibold max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-2
          max-sm:min-h-10 max-sm:w-full max-sm:min-w-0 max-sm:text-lg ${
            entry.rating === null
              ? 'border-fg/10 bg-fg/6 text-muted'
              : 'border-accent/40 bg-accent/18 text-accent-lift'
          }`}
      >
        {entry.rating ?? '—'}
      </span>
    </>
  );

  const shell = `grid grid-cols-[7rem_1fr_auto] items-center gap-5 rounded-3xl border
    border-fg/9 bg-surface/58 p-4 backdrop-blur-lg transition
    max-sm:grid-cols-[4.75rem_1fr] max-sm:items-start max-sm:gap-3.5 max-sm:p-3`;

  if (!onOpen) {
    return <article className={shell}>{body}</article>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${shell} w-full text-left hover:translate-x-1 hover:border-accent/45
        hover:shadow-xl hover:shadow-black/50`}
    >
      {body}
    </button>
  );
}
