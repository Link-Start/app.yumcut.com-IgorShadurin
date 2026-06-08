import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error, ok } from '@/server/http';
import { precheckAdminCharacterImportRows } from '@/server/admin/characters';

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const body = await req.json().catch(() => null) as {
    categoryId?: unknown;
    rows?: Array<{
      key?: unknown;
      slug?: unknown;
      name?: unknown;
      title?: unknown;
      bio?: unknown;
    }>;
  } | null;

  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId.trim() : '';
  const rowsRaw = Array.isArray(body?.rows) ? body.rows : [];

  if (!rowsRaw.length) {
    return error('VALIDATION_ERROR', 'rows are required', 400);
  }
  if (rowsRaw.length > 100) {
    return error('VALIDATION_ERROR', 'rows must contain at most 100 items per request', 400);
  }

  const rows = rowsRaw.map((row, index) => ({
    key: typeof row?.key === 'string' && row.key.trim().length > 0 ? row.key.trim() : `row-${index}`,
    slug: typeof row?.slug === 'string' ? row.slug : '',
    name: typeof row?.name === 'string' ? row.name : '',
    title: typeof row?.title === 'string' ? row.title : '',
    bio: typeof row?.bio === 'string' ? row.bio : '',
  }));

  const result = await precheckAdminCharacterImportRows({
    categoryId,
    rows,
  });

  return ok(result);
}, 'Failed to precheck import rows');
