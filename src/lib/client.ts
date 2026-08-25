'use client';

/** Thrown for any non-2xx API response, carrying the server error envelope. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };

/** Typed fetch wrapper for the JSON API. Cookies ride along by default. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const envelope = (payload ?? {}) as ErrorEnvelope;
    throw new ApiError(
      envelope.error?.message ?? `Ошибка ${response.status}`,
      response.status,
      envelope.error?.code ?? 'unknown',
      envelope.error?.details,
    );
  }

  return payload as T;
}

/** Turns any thrown value into a message safe to show in the UI. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Что-то пошло не так';
}
