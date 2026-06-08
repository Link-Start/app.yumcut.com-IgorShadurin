import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error, ok } from '@/server/http';
import { createAdminCharacterCategory, listAdminCharacterCategories } from '@/server/admin/characters';

export const GET = withApiError(async function GET() {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const items = await listAdminCharacterCategories();
  return ok({ items });
}, 'Failed to list character categories');

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const body = await req.json();
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
  const priority = typeof body?.priority === 'number' && Number.isFinite(body.priority) ? Math.floor(body.priority) : 0;

  if (!slug) return error('VALIDATION_ERROR', 'slug is required', 400);
  if (!title) return error('VALIDATION_ERROR', 'title is required', 400);

  const created = await createAdminCharacterCategory({
    slug,
    title,
    isActive,
    priority,
  });

  return ok(created, { status: 201 });
}, 'Failed to create character category');
