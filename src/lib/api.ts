import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'not_configured'
  | 'upstream_error'
  | 'internal_error';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  not_configured: 501,
  upstream_error: 502,
  internal_error: 500,
};

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Uniform error envelope: `{ error: { code, message, details? } }`. */
export function fail(code: ApiErrorCode, message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status: STATUS[code] },
  );
}

/** Discriminated result so callers can `if (!parsed.ok) return parsed.response;`. */
export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Reads and validates a JSON request body. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail('bad_request', 'Body must be valid JSON') };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return { ok: false, response: fail('bad_request', 'Validation failed', details) };
  }
  return { ok: true, data: result.data };
}

/** Validates a URLSearchParams-shaped object. */
export function parseQuery<T>(url: string, schema: ZodType<T>): Parsed<T> {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return { ok: false, response: fail('bad_request', 'Invalid query parameters', details) };
  }
  return { ok: true, data: result.data };
}

/** Route Handler guard. Returns the user, or a 401 response to return as-is. */
export async function requireApiUser(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: fail('unauthorized', 'Sign in required') };
  return { ok: true, user };
}

/**
 * Wraps a handler body so an unexpected throw becomes a 500 envelope instead of
 * a framework HTML error page. Logs the cause server-side.
 */
export async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error('[api] unhandled error', error);
    return fail('internal_error', 'Unexpected server error');
  }
}
