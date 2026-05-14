import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertFavorite = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    userFavoriteCharacter: {
      upsert: upsertFavorite,
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    projectCharacterSelection: {
      findMany: vi.fn(),
    },
    character: {
      findFirst: vi.fn(),
    },
  },
}));

const moduleRef = await import('@/server/character-favorites');

describe('character favorites sorting helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes favorite createdAt on re-favorite upsert', async () => {
    await moduleRef.favoriteCharacterForUser('user-1', 'char-1');
    expect(upsertFavorite).toHaveBeenCalledTimes(1);

    const payload = upsertFavorite.mock.calls[0]?.[0] as {
      update?: { createdAt?: Date };
      create?: { userId: string; characterId: string };
    };

    expect(payload.create).toEqual({ userId: 'user-1', characterId: 'char-1' });
    expect(payload.update?.createdAt).toBeInstanceOf(Date);
  });

  it('sorts items by favorite recency first, then priority', () => {
    const now = Date.now();
    const items = [
      { id: 'a', priority: 20 },
      { id: 'b', priority: 40 },
      { id: 'c', priority: 30 },
      { id: 'd', priority: 10 },
    ];

    const favoriteCreatedAtByCharacterId = new Map<string, Date>([
      ['c', new Date(now - 1000)],
      ['a', new Date(now - 2000)],
    ]);

    const sorted = moduleRef.sortByFavoriteRecencyFirst(items, {
      getCharacterId: (item) => item.id,
      getPriority: (item) => item.priority,
      favoriteCreatedAtByCharacterId,
    });

    expect(sorted.map((item) => item.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('falls back to priority and stable order when favorite timestamps tie', () => {
    const sameTime = new Date('2026-01-01T00:00:00.000Z');
    const items = [
      { id: 'x', priority: 20 },
      { id: 'y', priority: 20 },
      { id: 'z', priority: 10 },
    ];

    const favoriteCreatedAtByCharacterId = new Map<string, Date>([
      ['x', sameTime],
      ['y', sameTime],
    ]);

    const sorted = moduleRef.sortByFavoriteRecencyFirst(items, {
      getCharacterId: (item) => item.id,
      getPriority: (item) => item.priority,
      favoriteCreatedAtByCharacterId,
    });

    expect(sorted.map((item) => item.id)).toEqual(['x', 'y', 'z']);
  });
});
