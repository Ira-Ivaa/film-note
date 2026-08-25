import { Poster } from '@/components/ui';
import { KIND_LABELS, STATUS_SHORT } from '@/lib/labels';
import type { LibraryItem } from '@/lib/library';

/**
 * Grid tile: artwork only. The title and a short synopsis surface over the
 * poster on hover or keyboard focus, so a shelf of covers reads like a shelf
 * of covers rather than a table of captions.
 *
 * On touch there is no hover, so the caption stays open permanently in a
 * compact form — title and meta, synopsis dropped, since four lines of text
 * over a phone-sized poster are unreadable anyway.
 *
 * `onOpen` is omitted for a friend's library, which renders a plain article.
 */
export function TitleCard({ item, onOpen }: { item: LibraryItem; onOpen?: () => void }) {
  const { entry, title } = item;

  const meta = [KIND_LABELS[title.kind], title.year, STATUS_SHORT[entry.status], entry.progress]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <Poster
        url={title.posterUrl}
        name={title.name}
        className="absolute inset-0 size-full transition duration-500
          group-hover:scale-105 group-hover:brightness-[0.72]
          group-focus-visible:scale-105 group-focus-visible:brightness-[0.72]
          touch:scale-100 touch:brightness-100"
      />

      {/* Always-on markers sit above the veil so the caption never hides them. */}
      {entry.rating !== null ? (
        <span
          className="absolute top-2 right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-xs
            font-semibold text-accent-fg shadow-md shadow-black/50"
        >
          ★ {entry.rating}
        </span>
      ) : null}

      {entry.isFavorite ? (
        <span
          title="В избранном"
          className="absolute top-2 left-2.5 z-10 text-sm text-accent-lift drop-shadow-md"
        >
          ♥
        </span>
      ) : null}

      <span
        className="veil absolute inset-0 z-3 flex flex-col justify-end p-3 opacity-0
          transition-opacity duration-300 group-hover:opacity-100
          group-focus-visible:opacity-100 touch:p-2.5 touch:opacity-100"
      >
        <span
          className="mb-2 h-0.5 w-7 rounded-full bg-accent transition-transform duration-300
            translate-y-2 group-hover:translate-y-0 group-focus-visible:translate-y-0 touch:hidden"
        />
        <span
          className="translate-y-2 text-[0.95rem] leading-tight font-semibold transition-transform
            duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0
            touch:translate-y-0 touch:text-[0.82rem]"
        >
          {title.name}
        </span>
        <span
          className="translate-y-2 text-xs text-accent-lift transition-transform duration-300
            group-hover:translate-y-0 group-focus-visible:translate-y-0
            touch:translate-y-0 touch:text-[0.66rem]"
        >
          {meta}
        </span>
        {title.overview ? (
          <span
            className="mt-1.5 line-clamp-4 translate-y-2 text-xs leading-snug text-fg-dim
              transition-transform duration-300 group-hover:translate-y-0
              group-focus-visible:translate-y-0 touch:hidden"
          >
            {title.overview}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!onOpen) {
    return <article className="tile group aspect-2/3">{body}</article>;
  }

  return (
    <button type="button" onClick={onOpen} className="tile tile-lift group aspect-2/3 text-left">
      {body}
    </button>
  );
}
