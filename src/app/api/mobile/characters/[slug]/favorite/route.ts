import { NextRequest } from 'next/server';
import { ok, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { requireMobileUserId } from '../../../shared/auth';
import {
  favoriteCharacterForUser,
  findPublicCharacterBySlug,
  getCharacterMetricsMap,
  unfavoriteCharacterForUser,
} from '@/server/character-favorites';

async function loadMetrics(userId: string, characterId: string) {
  const metrics = await getCharacterMetricsMap([characterId], userId);
  return metrics.get(characterId) ?? {
    creationsCount: 0,
    favoritesCount: 0,
    isFavorited: false,
  };
}

export const POST = withApiError(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }

  const { slug } = await params;
  const character = await findPublicCharacterBySlug(slug);
  if (!character) {
    return notFound('Character not found');
  }

  await favoriteCharacterForUser(auth.userId, character.id);
  const metrics = await loadMetrics(auth.userId, character.id);
  return ok({ ok: true, slug: character.slug, metrics });
}, 'Failed to favorite mobile character');

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }

  const { slug } = await params;
  const character = await findPublicCharacterBySlug(slug);
  if (!character) {
    return notFound('Character not found');
  }

  await unfavoriteCharacterForUser(auth.userId, character.id);
  const metrics = await loadMetrics(auth.userId, character.id);
  return ok({ ok: true, slug: character.slug, metrics });
}, 'Failed to unfavorite mobile character');
