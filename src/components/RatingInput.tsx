'use client';

import { Button } from '@/components/ui';

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** 1..10 picker. Clicking the active value clears the rating. */
export function RatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Оценка от 1 до 10">
      {VALUES.map((score) => {
        const active = value === score;
        return (
          <Button
            key={score}
            type="button"
            size="sm"
            variant={active ? 'primary' : 'outline'}
            disabled={disabled}
            aria-pressed={active}
            className="w-8"
            onClick={() => onChange(active ? null : score)}
          >
            {score}
          </Button>
        );
      })}
    </div>
  );
}
