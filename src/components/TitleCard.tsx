import { Badge, Poster } from '@/components/ui';
import { KIND_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/lib/labels';
import type { LibraryItem } from '@/lib/library';

/**
 * One library row rendered as a poster card. `onOpen` is omitted for read-only
 * views (a friend's library), which then renders a non-interactive article.
 */
export function TitleCard({
  item,
  onOpen,
}: {
  item: LibraryItem;
  onOpen?: () => void;
}) {
  const { entry, title } = item;

  const body = (
    <>
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-t-[calc(var(--radius-card)-1px)]">
        <Poster url={title.posterUrl} name={title.name} className="size-full" />

        {entry.rating !== null ? (
          <span
            className="absolute top-2 right-2 rounded-full bg-ink/85 px-2 py-0.5 text-xs
              font-semibold text-accent"
          >
            ★ {entry.rating}
          </span>
        ) : null}

        {entry.isFavorite ? (
          <span className="absolute top-2 left-2 text-sm" title="В избранном">
            ❤
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="line-clamp-2 text-sm leading-snug font-medium">{title.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {[KIND_LABELS[title.kind], title.year ?? null].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Badge className={STATUS_STYLES[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
          {entry.progress ? (
            <Badge className="border-line bg-surface-3 text-muted">{entry.progress}</Badge>
          ) : null}
        </div>
      </div>
    </>
  );

  const shell = 'card flex flex-col overflow-hidden text-left transition';

  if (!onOpen) {
    return <article className={shell}>{body}</article>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${shell} hover:border-accent/50 hover:shadow-lg hover:shadow-black/30`}
    >
      {body}
    </button>
  );
}
