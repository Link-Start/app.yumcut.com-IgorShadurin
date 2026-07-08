import { ok, unauthorized, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import {
  favoriteCharacterForUser,
  findPublicCharacterBySlug,
  getCharacterMetricsMap,
  unfavoriteCharacterForUser,
} from '@/server/character-favorites';
import { authenticateApiRequest } from '@/server/api-user';

async function loadMetrics(userId: string, characterId: string) {
  const metrics = await getCharacterMetricsMap([characterId], userId);
  return metrics.get(characterId) ?? {
    creationsCount: 0,
    favoritesCount: 0,
    isFavorited: false,
  };
}

export const POST = withApiError(async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await authenticateApiRequest(req as any);
  if (!auth) return unauthorized();
  const userId = auth.userId;

  const { slug } = await params;
  const character = await findPublicCharacterBySlug(slug);
  if (!character) {
    return notFound('Character not found');
  }

  await favoriteCharacterForUser(userId, character.id);
  const metrics = await loadMetrics(userId, character.id);
  return ok({ ok: true, slug: character.slug, metrics });
}, 'Failed to favorite character');

export const DELETE = withApiError(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await authenticateApiRequest(req as any);
  if (!auth) return unauthorized();
  const userId = auth.userId;

  const { slug } = await params;
  const character = await findPublicCharacterBySlug(slug);
  if (!character) {
    return notFound('Character not found');
  }

  await unfavoriteCharacterForUser(userId, character.id);
  const metrics = await loadMetrics(userId, character.id);
  return ok({ ok: true, slug: character.slug, metrics });
}, 'Failed to unfavorite character');
