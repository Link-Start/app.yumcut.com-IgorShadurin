import { NextRequest } from 'next/server';
import { ok, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { requireMobileUserId } from '../../shared/auth';
import { getCharacterCatalogProfileBySlug } from '@/server/character-catalog';

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }

  const { slug } = await params;
  const character = await getCharacterCatalogProfileBySlug(slug, { viewerUserId: auth.userId });
  if (!character) {
    return notFound('Character not found');
  }

  return ok(character);
}, 'Failed to load mobile character profile');
