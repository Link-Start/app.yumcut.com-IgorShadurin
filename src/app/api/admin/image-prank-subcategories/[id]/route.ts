import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/server/admin';
import { withApiError } from '@/server/errors';
import { ok, notFound } from '@/server/http';
import {
  deleteAdminImagePrankSubcategory,
  updateAdminImagePrankSubcategory,
} from '@/server/admin/image-pranks';

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  const body = await req.json();
  const updated = await updateAdminImagePrankSubcategory(id, {
    categoryId: typeof body?.categoryId === 'string' ? body.categoryId : undefined,
    slug: typeof body?.slug === 'string' ? body.slug : undefined,
    title: typeof body?.title === 'string' ? body.title : undefined,
    subtitle: body?.subtitle === null || typeof body?.subtitle === 'string' ? body.subtitle : undefined,
    isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined,
    priority: typeof body?.priority === 'number' ? body.priority : undefined,
  });

  return ok(updated);
}, 'Failed to update image prank subcategory');

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const { id } = await params;
  if (!id) return notFound();
  const deleteFiles = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('deleteFiles') || '').toLowerCase());
  await deleteAdminImagePrankSubcategory(id, deleteFiles);
  return ok({ ok: true });
}, 'Failed to delete image prank subcategory');
