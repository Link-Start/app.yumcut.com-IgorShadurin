import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error as httpError, ok, notFound } from '@/server/http';
import { softDeleteAdminCharacter, updateAdminCharacter } from '@/server/admin/characters';

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  const body = await req.json();
  if (body?.categoryId === null) {
    return httpError('VALIDATION_ERROR', 'Category is required', 400);
  }
  await updateAdminCharacter(id, {
    slug: typeof body?.slug === 'string' ? body.slug : undefined,
    name: typeof body?.name === 'string' ? body.name : undefined,
    title: typeof body?.title === 'string' ? body.title : undefined,
    bio: body?.bio === null || typeof body?.bio === 'string' ? body.bio : undefined,
    isPublic: typeof body?.isPublic === 'boolean' ? body.isPublic : undefined,
    priority: typeof body?.priority === 'number' ? body.priority : undefined,
    categoryId: typeof body?.categoryId === 'string' ? body.categoryId : undefined,
    previewVideoHasAudio: typeof body?.previewVideoHasAudio === 'boolean' ? body.previewVideoHasAudio : undefined,
  });

  return ok({ ok: true });
}, 'Failed to update admin character');

export const DELETE = withApiError(async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const { id } = await params;
  if (!id) return notFound();
  const deleteFiles = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('deleteFiles') || '').toLowerCase());
  await softDeleteAdminCharacter(id, deleteFiles);
  return ok({ ok: true });
}, 'Failed to delete admin character');
