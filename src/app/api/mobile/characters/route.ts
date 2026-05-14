import { NextRequest } from 'next/server';
import { ok } from '@/server/http';
import { withApiError } from '@/server/errors';
import { prisma } from '@/server/db';
import { getViewerFavoriteCreatedAtMap, sortByFavoriteRecencyFirst } from '@/server/character-favorites';
import { normalizeMediaUrl } from '@/server/storage';
import { requireMobileUserId } from '../shared/auth';

function normalizeGlobalImagePath(imagePath: string | null | undefined) {
  return normalizeMediaUrl(imagePath);
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }

  const [globalChars, userChars] = await Promise.all([
    prisma.character.findMany({
      where: { isCatalogPublic: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        variations: {
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        },
      },
    }),
    prisma.userCharacter.findMany({
      where: { userId: auth.userId, deleted: false },
      include: { variations: { where: { deleted: false }, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const favoriteCreatedAtByCharacterId = await getViewerFavoriteCreatedAtMap(
    globalChars.map((character) => character.id),
    auth.userId,
  );
  const sortedGlobalChars = sortByFavoriteRecencyFirst(globalChars, {
    getCharacterId: (item) => item.id,
    getPriority: (item) => Number(item.priority) || 0,
    favoriteCreatedAtByCharacterId,
  });

  const mapGlobal = sortedGlobalChars.map((character) => ({
    id: character.id,
    title: character.name?.trim() || character.title,
    description: character.bio ?? character.description,
    variations: character.variations.map((variation) => ({
      id: variation.id,
      title: variation.title,
      description: variation.description,
      prompt: variation.prompt,
      imageUrl: normalizeGlobalImagePath(variation.imagePath) ?? '',
      status: 'ready' as const,
    })),
  }));

  const mapUser = userChars.map((character) => ({
    id: character.id,
    title: character.title,
    description: character.description,
    variations: character.variations.map((variation) => ({
      id: variation.id,
      title: variation.title,
      description: variation.description,
      prompt: variation.prompt,
      imageUrl: variation.imageUrl ?? normalizeMediaUrl(variation.imagePath ?? null),
      status: variation.status as 'ready' | 'processing' | 'failed',
    })),
  }));

  return ok({ global: mapGlobal, mine: mapUser });
}, 'Failed to load characters');
