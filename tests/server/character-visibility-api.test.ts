import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateApiRequest = vi.hoisted(() => vi.fn());
const requireMobileUserId = vi.hoisted(() => vi.fn());
const characterFindMany = vi.hoisted(() => vi.fn());
const userCharacterFindMany = vi.hoisted(() => vi.fn());
const getViewerFavoriteCreatedAtMap = vi.hoisted(() => vi.fn());
const sortByFavoriteRecencyFirst = vi.hoisted(() => vi.fn());

vi.mock('@/server/api-user', () => ({ authenticateApiRequest }));
vi.mock('@/app/api/mobile/shared/auth', () => ({ requireMobileUserId }));
vi.mock('@/server/character-favorites', () => ({
  getViewerFavoriteCreatedAtMap,
  sortByFavoriteRecencyFirst,
}));
vi.mock('@/server/db', () => ({
  prisma: {
    character: { findMany: characterFindMany },
    userCharacter: { findMany: userCharacterFindMany },
  },
}));

describe('character visibility in public APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiRequest.mockResolvedValue({ userId: 'u1', source: 'session' });
    requireMobileUserId.mockResolvedValue({ userId: 'u1' });
    characterFindMany.mockResolvedValue([]);
    userCharacterFindMany.mockResolvedValue([]);
    getViewerFavoriteCreatedAtMap.mockResolvedValue(new Map());
    sortByFavoriteRecencyFirst.mockImplementation((items: unknown[]) => items);
  });

  it('web /api/characters requests only public global characters', async () => {
    const route = await import('@/app/api/characters/route');
    const res = await route.GET(new Request('http://localhost/api/characters'));
    expect(res.status).toBe(200);
    expect(characterFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isCatalogPublic: true } }));
  });

  it('mobile /api/mobile/characters requests only public global characters', async () => {
    const route = await import('@/app/api/mobile/characters/route');
    const req = new NextRequest('http://localhost/api/mobile/characters');
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    expect(characterFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isCatalogPublic: true } }));
  });
});
