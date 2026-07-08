import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateApiRequest = vi.hoisted(() => vi.fn());
const favoriteCharacterForUser = vi.hoisted(() => vi.fn());
const unfavoriteCharacterForUser = vi.hoisted(() => vi.fn());
const findPublicCharacterBySlug = vi.hoisted(() => vi.fn());
const getCharacterMetricsMap = vi.hoisted(() => vi.fn());

vi.mock('@/server/api-user', () => ({ authenticateApiRequest }));
vi.mock('@/server/character-favorites', () => ({
  favoriteCharacterForUser,
  unfavoriteCharacterForUser,
  findPublicCharacterBySlug,
  getCharacterMetricsMap,
}));

const route = await import('@/app/api/characters/[slug]/favorite/route');

describe('web character favorite API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiRequest.mockResolvedValue({ userId: 'user-1', source: 'session' });
    findPublicCharacterBySlug.mockResolvedValue({ id: 'char-1', slug: 'kim-masters' });
    getCharacterMetricsMap.mockResolvedValue(new Map([
      ['char-1', { creationsCount: 4, favoritesCount: 6, isFavorited: true }],
    ]));
  });

  it('requires authentication', async () => {
    authenticateApiRequest.mockResolvedValue(null);
    const res = await route.POST(new Request('http://localhost/api/characters/kim-masters/favorite', { method: 'POST' }), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(401);
  });

  it('favorites a character', async () => {
    const res = await route.POST(new Request('http://localhost/api/characters/kim-masters/favorite', { method: 'POST' }), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(favoriteCharacterForUser).toHaveBeenCalledWith('user-1', 'char-1');
    expect(payload.metrics.favoritesCount).toBe(6);
  });

  it('unfavorites a character', async () => {
    getCharacterMetricsMap.mockResolvedValue(new Map([
      ['char-1', { creationsCount: 4, favoritesCount: 5, isFavorited: false }],
    ]));
    const res = await route.DELETE(new Request('http://localhost/api/characters/kim-masters/favorite', { method: 'DELETE' }), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(unfavoriteCharacterForUser).toHaveBeenCalledWith('user-1', 'char-1');
    expect(payload.metrics).toEqual({ creationsCount: 4, favoritesCount: 5, isFavorited: false });
  });
});
