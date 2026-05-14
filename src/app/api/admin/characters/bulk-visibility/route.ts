import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error as httpError, ok } from '@/server/http';
import { bulkSetAdminCharactersVisibility } from '@/server/admin/characters';

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return httpError('FORBIDDEN', 'Invalid origin', 403);
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
  const isPublic = body?.isPublic;
  if (!ids.length) return httpError('BAD_REQUEST', 'ids are required', 400);
  if (ids.length > 2000) return httpError('BAD_REQUEST', 'Too many ids', 400);
  if (typeof isPublic !== 'boolean') return httpError('BAD_REQUEST', 'isPublic boolean is required', 400);

  const updated = await bulkSetAdminCharactersVisibility(ids, isPublic);
  return ok({ ok: true, updated });
}, 'Failed to update selected character visibility');
