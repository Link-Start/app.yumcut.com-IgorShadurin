import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error as httpError, ok } from '@/server/http';
import { getNextAdminCharacterPriority } from '@/server/admin/characters';

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const categoryId = (req.nextUrl.searchParams.get('categoryId') || '').trim();
  if (!categoryId) {
    return httpError('BAD_REQUEST', 'categoryId is required', 400);
  }

  const result = await getNextAdminCharacterPriority(categoryId);
  return ok(result);
}, 'Failed to load next character priority');
