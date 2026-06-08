import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error as httpError, ok } from '@/server/http';
import { softDeleteAdminCharacters } from '@/server/admin/characters';
import { isSameSiteRequestOrigin } from '@/server/request-origin';

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  if (!isSameSiteRequestOrigin(req)) {
    return httpError('FORBIDDEN', 'Invalid origin', 403);
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
  const deleteFiles = body?.deleteFiles === true;
  if (!ids.length) return httpError('BAD_REQUEST', 'ids are required', 400);
  if (ids.length > 2000) return httpError('BAD_REQUEST', 'Too many ids', 400);

  const deleted = await softDeleteAdminCharacters(ids, deleteFiles);
  return ok({ ok: true, deleted });
}, 'Failed to bulk delete admin characters');
