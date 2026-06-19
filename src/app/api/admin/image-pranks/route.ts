import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/server/admin';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import {
  createAdminImagePrankItem,
  listAdminImagePranks,
} from '@/server/admin/image-pranks';

function parseFormNumber(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFormBoolean(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const categoryId = (req.nextUrl.searchParams.get('categoryId') || '').trim();
  const pageRaw = Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSizeRaw = Number.parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10);
  const result = await listAdminImagePranks({
    query: q,
    categoryId: categoryId || null,
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
    pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20,
  });

  return ok(result);
}, 'Failed to list image pranks');

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const form = await req.formData();
  const image = form.get('image');
  if (!(image instanceof File) || image.size <= 0) {
    return error('VALIDATION_ERROR', 'image is required', 400);
  }

  const categoryId = typeof form.get('categoryId') === 'string' ? String(form.get('categoryId')).trim() : '';
  const slug = typeof form.get('slug') === 'string' ? String(form.get('slug')).trim() : '';
  const title = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : '';
  if (!categoryId) return error('VALIDATION_ERROR', 'categoryId is required', 400);
  if (!slug) return error('VALIDATION_ERROR', 'slug is required', 400);
  if (!title) return error('VALIDATION_ERROR', 'title is required', 400);

  const created = await createAdminImagePrankItem({
    categoryId,
    slug,
    title,
    description: typeof form.get('description') === 'string' ? String(form.get('description')) : null,
    searchText: typeof form.get('searchText') === 'string' ? String(form.get('searchText')) : null,
    isPublic: parseFormBoolean(form.get('isPublic'), false),
    priority: parseFormNumber(form.get('priority'), 0),
    image,
  });

  return ok(created, { status: 201 });
}, 'Failed to create image prank');
