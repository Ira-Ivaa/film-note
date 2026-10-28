'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, errorMessage } from '@/lib/client';
import { Alert, Button, Field, Spinner } from '@/components/ui';

type Mode = 'login' | 'register';

const COPY = {
  login: {
    title: 'Вход',
    submit: 'Войти',
    switchText: 'Нет аккаунта?',
    switchHref: '/register',
    switchLabel: 'Зарегистрироваться',
  },
  register: {
    title: 'Регистрация',
    submit: 'Создать аккаунт',
    switchText: 'Уже есть аккаунт?',
    switchHref: '/login',
    switchLabel: 'Войти',
  },
} as const;

/** Shared login/registration form. Posts to /api/auth/* and then reloads server state. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload =
      mode === 'login'
        ? {
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          }
        : {
            email: String(form.get('email') ?? ''),
            username: String(form.get('username') ?? ''),
            displayName: String(form.get('displayName') ?? ''),
            password: String(form.get('password') ?? ''),
          };

    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) });
      // The session cookie is set by the response; refresh so Server Components
      // re-read it, then navigate.
      router.refresh();
      router.replace('/library');
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  }

  return (
    <div className="card w-full max-w-sm p-6 sm:p-7">
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted">Блокнот для фильмов, сериалов, дорам и аниме.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <input
            className="input-base"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </Field>

        {mode === 'register' ? (
          <>
            <Field label="Имя" hint="Как вас увидят друзья">
              <input
                className="input-base"
                name="displayName"
                type="text"
                autoComplete="name"
                required
                maxLength={64}
                placeholder="name"
              />
            </Field>
            <Field label="Логин" hint="a-z, 0-9 и подчёркивание — по нему вас найдут друзья">
              <input
                className="input-base"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_]+"
                placeholder="movie_fan"
              />
            </Field>
          </>
        ) : null}

        <Field label="Пароль" hint={mode === 'register' ? 'Минимум 8 символов' : undefined}>
          <input
            className="input-base"
            name="password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            maxLength={72}
          />
        </Field>

        {error ? <Alert>{error}</Alert> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Spinner /> : null}
          {copy.submit}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {copy.switchText}{' '}
        <Link href={copy.switchHref} className="text-accent hover:underline">
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
