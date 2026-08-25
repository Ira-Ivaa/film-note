import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { put } from '@vercel/blob';

import { env } from '@/lib/env';

/**
 * Vercel's serverless request body cap is 4.5 MB, so a server-side upload must
 * stay below it. Raising this requires switching to client uploads
 * (`@vercel/blob/client` + a token-issuing route).
 */
export const MAX_POSTER_BYTES = 4 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export const ACCEPTED_POSTER_TYPES = Object.keys(EXTENSION_BY_TYPE);

export type StorageFailure =
  | { kind: 'unsupported_type'; received: string }
  | { kind: 'too_large'; bytes: number }
  | { kind: 'empty' };

export class StorageError extends Error {
  constructor(readonly failure: StorageFailure) {
    super(`Poster rejected: ${failure.kind}`);
    this.name = 'StorageError';
  }
}

/**
 * Persists an uploaded poster photo and returns a URL usable in an <img> tag.
 *
 * driver 'vercel-blob' -> public Blob URL (required in production; the Vercel
 * filesystem is read-only). driver 'local' -> public/uploads/<uuid>.<ext>,
 * served statically by Next in development.
 */
export async function savePoster(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const extension = EXTENSION_BY_TYPE[type];
  if (!extension) throw new StorageError({ kind: 'unsupported_type', received: type });
  if (file.size === 0) throw new StorageError({ kind: 'empty' });
  if (file.size > MAX_POSTER_BYTES) {
    throw new StorageError({ kind: 'too_large', bytes: file.size });
  }

  // Name is generated, never taken from the client, so upload cannot traverse
  // paths or overwrite an existing object.
  const objectName = `posters/${randomUUID()}.${extension}`;

  if (env.storageDriver === 'vercel-blob') {
    const result = await put(objectName, file, {
      access: 'public',
      contentType: type,
      addRandomSuffix: false,
      ...(env.blobToken ? { token: env.blobToken } : {}),
    });
    return result.url;
  }

  const targetDir = path.join(process.cwd(), 'public', 'uploads', 'posters');
  await mkdir(targetDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(targetDir, path.basename(objectName)), bytes);
  return `/uploads/${objectName}`;
}
