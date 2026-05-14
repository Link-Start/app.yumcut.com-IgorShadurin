import { prisma } from '@/server/db';

export type CharacterMetrics = {
  creationsCount: number;
  favoritesCount: number;
  isFavorited: boolean;
};

export type PublicCharacterRecord = {
  id: string;
  slug: string;
};

type FavoriteCountRow = {
  characterId: string;
  _count: {
    _all: number;
  };
};

export async function findPublicCharacterBySlug(slug: string): Promise<PublicCharacterRecord | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const character = await prisma.character.findFirst({
    where: {
      slug: normalizedSlug,
      isCatalogPublic: true,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!character?.slug) return null;
  return {
    id: character.id,
    slug: character.slug,
  };
}

export async function favoriteCharacterForUser(userId: string, characterId: string) {
  await prisma.userFavoriteCharacter.upsert({
    where: {
      userId_characterId: {
        userId,
        characterId,
      },
    },
    update: {
      createdAt: new Date(),
    },
    create: {
      userId,
      characterId,
    },
  });
}

export async function unfavoriteCharacterForUser(userId: string, characterId: string) {
  await prisma.userFavoriteCharacter.deleteMany({
    where: {
      userId,
      characterId,
    },
  });
}

export async function getCharacterMetricsMap(
  characterIds: string[],
  viewerUserId?: string | null,
): Promise<Map<string, CharacterMetrics>> {
  const uniqueIds = Array.from(new Set(characterIds.filter((value) => typeof value === 'string' && value.trim().length > 0)));
  const metrics = new Map<string, CharacterMetrics>();

  if (uniqueIds.length === 0) {
    return metrics;
  }

  const [projectSelections, favoriteCounts, viewerFavorites] = await Promise.all([
    prisma.projectCharacterSelection.findMany({
      where: {
        characterId: { in: uniqueIds },
        project: {
          deleted: false,
        },
      },
      select: {
        characterId: true,
      },
    }),
    prisma.userFavoriteCharacter.groupBy({
      by: ['characterId'],
      where: {
        characterId: { in: uniqueIds },
      },
      _count: {
        _all: true,
      },
    }),
    viewerUserId
      ? prisma.userFavoriteCharacter.findMany({
        where: {
          userId: viewerUserId,
          characterId: { in: uniqueIds },
        },
        select: {
          characterId: true,
        },
      })
      : Promise.resolve([] as Array<{ characterId: string }>),
  ]);

  const creationCounts = new Map<string, number>();
  for (const row of projectSelections) {
    if (!row.characterId) continue;
    creationCounts.set(row.characterId, (creationCounts.get(row.characterId) ?? 0) + 1);
  }

  const favoriteCountMap = new Map<string, number>();
  for (const row of favoriteCounts as FavoriteCountRow[]) {
    favoriteCountMap.set(row.characterId, row._count._all);
  }

  const favoriteSet = new Set(viewerFavorites.map((row) => row.characterId));

  for (const characterId of uniqueIds) {
    metrics.set(characterId, {
      creationsCount: creationCounts.get(characterId) ?? 0,
      favoritesCount: favoriteCountMap.get(characterId) ?? 0,
      isFavorited: favoriteSet.has(characterId),
    });
  }

  return metrics;
}

export async function getViewerFavoriteCreatedAtMap(
  characterIds: string[],
  viewerUserId?: string | null,
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (!viewerUserId) return result;

  const uniqueIds = Array.from(new Set(characterIds.filter((value) => typeof value === 'string' && value.trim().length > 0)));
  if (uniqueIds.length === 0) return result;

  const rows = await prisma.userFavoriteCharacter.findMany({
    where: {
      userId: viewerUserId,
      characterId: { in: uniqueIds },
    },
    select: {
      characterId: true,
      createdAt: true,
    },
  });

  for (const row of rows) {
    result.set(row.characterId, row.createdAt);
  }

  return result;
}

export function sortByFavoriteRecencyFirst<T>(
  items: T[],
  options: {
    getCharacterId: (item: T) => string;
    getPriority: (item: T) => number;
    favoriteCreatedAtByCharacterId: Map<string, Date>;
  },
): T[] {
  const withIndex = items.map((item, index) => ({
    item,
    index,
    characterId: options.getCharacterId(item),
    priority: options.getPriority(item),
  }));

  withIndex.sort((a, b) => {
    const aFavoriteAt = options.favoriteCreatedAtByCharacterId.get(a.characterId) ?? null;
    const bFavoriteAt = options.favoriteCreatedAtByCharacterId.get(b.characterId) ?? null;
    const aIsFavorited = !!aFavoriteAt;
    const bIsFavorited = !!bFavoriteAt;

    if (aIsFavorited !== bIsFavorited) {
      return aIsFavorited ? -1 : 1;
    }

    if (aFavoriteAt && bFavoriteAt) {
      const favoriteDiff = bFavoriteAt.getTime() - aFavoriteAt.getTime();
      if (favoriteDiff !== 0) return favoriteDiff;
    }

    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;

    return a.index - b.index;
  });

  return withIndex.map((entry) => entry.item);
}
