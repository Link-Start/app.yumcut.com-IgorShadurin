import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/server/admin';
import { withApiError } from '@/server/errors';
import { ok, notFound } from '@/server/http';
import {
  deleteAdminImagePrankItem,
  updateAdminImagePrankItem,
} from '@/server/admin/image-pranks';

function formString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === 'string' ? value : undefined;
}

function formNullableString(form: FormData, key: string): string | null | undefined {
  const value = form.get(key);
  if (value === null) return undefined;
  return typeof value === 'string' ? value : undefined;
}

function formBoolean(form: FormData, key: string): boolean | undefined {
  const value = form.get(key);
  if (typeof value !== 'string') return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function formNumber(form: FormData, key: string): number | undefined {
  const value = form.get(key);
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  const form = await req.formData();
  const image = form.get('image');
  const updated = await updateAdminImagePrankItem(id, {
    categoryId: formString(form, 'categoryId'),
    slug: formString(form, 'slug'),
    title: formString(form, 'title'),
    description: formNullableString(form, 'description'),
    searchText: formNullableString(form, 'searchText'),
    isPublic: formBoolean(form, 'isPublic'),
    priority: formNumber(form, 'priority'),
    image: image instanceof File && image.size > 0 ? image : null,
  });

  return ok(updated);
}, 'Failed to update image prank');

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;

  const { id } = await params;
  if (!id) return notFound();
  const deleteFiles = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('deleteFiles') || '').toLowerCase());
  await deleteAdminImagePrankItem(id, deleteFiles);
  return ok({ ok: true });
}, 'Failed to delete image prank');
