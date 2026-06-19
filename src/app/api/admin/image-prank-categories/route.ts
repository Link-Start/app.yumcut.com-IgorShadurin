import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/server/admin';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import {
  createAdminImagePrankCategory,
  listAdminImagePrankCategories,
} from '@/server/admin/image-pranks';

export const GET = withApiError(async function GET() {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  return ok({ items: await listAdminImagePrankCategories() });
}, 'Failed to list image prank categories');

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const body = await req.json();
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const subtitle = typeof body?.subtitle === 'string' ? body.subtitle.trim() : '';
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
  const priority = typeof body?.priority === 'number' && Number.isFinite(body.priority) ? Math.floor(body.priority) : 0;

  if (!slug) return error('VALIDATION_ERROR', 'slug is required', 400);
  if (!title) return error('VALIDATION_ERROR', 'title is required', 400);

  const created = await createAdminImagePrankCategory({
    slug,
    title,
    subtitle,
    isActive,
    priority,
  });

  return ok(created, { status: 201 });
}, 'Failed to create image prank category');
