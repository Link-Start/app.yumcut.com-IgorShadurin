import { getAuthSession } from '@/server/auth';
import { ok, unauthorized, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
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
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getAuthSession();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return unauthorized();

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
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await getAuthSession();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return unauthorized();

  const { slug } = await params;
  const character = await findPublicCharacterBySlug(slug);
  if (!character) {
    return notFound('Character not found');
  }

  await unfavoriteCharacterForUser(userId, character.id);
  const metrics = await loadMetrics(userId, character.id);
  return ok({ ok: true, slug: character.slug, metrics });
}, 'Failed to unfavorite character');
