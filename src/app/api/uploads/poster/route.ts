import { fail, guard, ok, requireApiUser } from '@/lib/api';
import { ACCEPTED_POSTER_TYPES, MAX_POSTER_BYTES, StorageError, savePoster } from '@/lib/storage';

/**
 * POST /api/uploads/poster  (multipart/form-data, field "file") -> { url }
 *
 * Accepts a photo of a poster from the user's device. The stored object name is
 * generated server-side, so the client cannot influence the path.
 */
export async function POST(request: Request) {
  return guard(async () => {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return fail('unsupported_media_type', 'Expected multipart/form-data with a "file" field');
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail('bad_request', 'Malformed multipart body');
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return fail('bad_request', 'Missing "file" field');
    }

    try {
      return ok({ url: await savePoster(file) }, 201);
    } catch (error) {
      if (!(error instanceof StorageError)) throw error;
      const { failure } = error;

      if (failure.kind === 'unsupported_type') {
        return fail(
          'unsupported_media_type',
          `Allowed types: ${ACCEPTED_POSTER_TYPES.join(', ')}`,
          { received: failure.received },
        );
      }
      if (failure.kind === 'too_large') {
        return fail(
          'payload_too_large',
          `Poster must be under ${MAX_POSTER_BYTES / 1024 / 1024} MB`,
          { bytes: failure.bytes },
        );
      }
      return fail('bad_request', 'Uploaded file is empty');
    }
  });
}
