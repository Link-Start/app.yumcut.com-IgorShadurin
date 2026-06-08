import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { ok } from '@/server/http';
import { listAdminCharacters } from '@/server/admin/characters';

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const categoryId = (req.nextUrl.searchParams.get('categoryId') || '').trim();
  const pageRaw = Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSizeRaw = Number.parseInt(req.nextUrl.searchParams.get('pageSize') || '10', 10);
  const result = await listAdminCharacters({
    query: q,
    categoryId: categoryId || null,
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
    pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : 10,
  });
  return ok(result);
}, 'Failed to list admin characters');
