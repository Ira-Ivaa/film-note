'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/client';
import { VISIBILITY_LABELS } from '@/lib/labels';
import type { ListVisibility } from '@/db/schema';

const VISIBILITY_ORDER: ListVisibility[] = ['private', 'friends', 'public'];

/** Display name and who may see the library. */
export function ProfileForm({
  initialDisplayName,
  initialVisibility,
}: {
  initialDisplayName: string;
  initialVisibility: ListVisibility;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [listVisibility, setListVisibility] = useState<ListVisibility>(initialVisibility);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim(), listVisibility }),
      });
      setSaved(true);
      // The nav shows the display name, so server state must be re-read.
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-md space-y-4 p-5">
      <Field label="Имя">
        <input
          className="input-base"
          value={displayName}
          required
          maxLength={64}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </Field>

      <Field label="Кто видит мою библиотеку">
        <select
          className="input-base"
          value={listVisibility}
          onChange={(event) => setListVisibility(event.target.value as ListVisibility)}
        >
          {VISIBILITY_ORDER.map((value) => (
            <option key={value} value={value}>
              {VISIBILITY_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      {error ? <Alert>{error}</Alert> : null}
      {saved ? <Alert tone="info">Сохранено</Alert> : null}

      <Button type="submit" disabled={pending || displayName.trim().length === 0}>
        {pending ? <Spinner /> : null}
        Сохранить
      </Button>
    </form>
  );
}
