import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error, ok } from '@/server/http';
import { isAdminCharacterSlugAvailable, slugify } from '@/server/admin/characters';

export const GET = withApiError(async function GET(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const slugRaw = (req.nextUrl.searchParams.get('slug') || '').trim();
  const categoryIdRaw = (req.nextUrl.searchParams.get('categoryId') || '').trim();
  const excludeIdRaw = (req.nextUrl.searchParams.get('excludeId') || '').trim();

  const normalizedSlug = slugify(slugRaw);
  if (!normalizedSlug) return error('VALIDATION_ERROR', 'slug is required', 400);

  const available = await isAdminCharacterSlugAvailable({
    slug: normalizedSlug,
    categoryId: categoryIdRaw || null,
    excludeCharacterId: excludeIdRaw || null,
  });

  return ok({ available, normalizedSlug });
}, 'Failed to check character slug availability');
