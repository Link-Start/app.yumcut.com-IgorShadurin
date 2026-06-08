import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error as httpError, ok } from '@/server/http';
import { applyAdminCharacterPriorities } from '@/server/admin/characters';
import { isSameSiteRequestOrigin } from '@/server/request-origin';

const MAX_PRIORITY_SLUGS = 10000;

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  if (!isSameSiteRequestOrigin(req)) {
    return httpError('FORBIDDEN', 'Invalid origin', 403);
  }

  const body = await req.json().catch(() => null);
  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId.trim() : '';
  const slugs = Array.isArray(body?.slugs)
    ? body.slugs.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  if (!categoryId) return httpError('BAD_REQUEST', 'categoryId is required', 400);
  if (!slugs.length) return httpError('BAD_REQUEST', 'slugs are required', 400);
  if (slugs.length > MAX_PRIORITY_SLUGS) {
    return httpError('BAD_REQUEST', `Too many slugs (max ${MAX_PRIORITY_SLUGS})`, 400);
  }

  const result = await applyAdminCharacterPriorities({
    categoryId,
    slugs,
  });
  return ok(result);
}, 'Failed to apply admin character priorities');
