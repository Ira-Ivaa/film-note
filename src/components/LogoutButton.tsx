'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/lib/client';
import { Button } from '@/components/ui';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api('/api/auth/logout', { method: 'POST' });
        } finally {
          router.refresh();
          router.replace('/login');
        }
      }}
    >
      Выйти
    </Button>
  );
}
