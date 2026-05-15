import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireMobileUserId = vi.hoisted(() => vi.fn());
const listMobileCharacterCatalog = vi.hoisted(() => vi.fn());
const getCharacterCatalogProfileBySlug = vi.hoisted(() => vi.fn());
const favoriteCharacterForUser = vi.hoisted(() => vi.fn());
const unfavoriteCharacterForUser = vi.hoisted(() => vi.fn());
const findPublicCharacterBySlug = vi.hoisted(() => vi.fn());
const getCharacterMetricsMap = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/mobile/shared/auth', () => ({ requireMobileUserId }));
vi.mock('@/server/character-catalog', () => ({
  listMobileCharacterCatalog,
  getCharacterCatalogProfileBySlug,
}));
vi.mock('@/server/character-favorites', () => ({
  favoriteCharacterForUser,
  unfavoriteCharacterForUser,
  findPublicCharacterBySlug,
  getCharacterMetricsMap,
}));

const catalogRoute = await import('@/app/api/mobile/character-catalog/route');
const profileRoute = await import('@/app/api/mobile/characters/[slug]/route');
const favoriteRoute = await import('@/app/api/mobile/characters/[slug]/favorite/route');

function makeRequest(path: string, token?: string, method = 'GET') {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as any);
}

describe('mobile character catalog APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMobileUserId.mockResolvedValue({ userId: 'user-1' });
    listMobileCharacterCatalog.mockResolvedValue([]);
    getCharacterCatalogProfileBySlug.mockResolvedValue(null);
    favoriteCharacterForUser.mockResolvedValue(undefined);
    unfavoriteCharacterForUser.mockResolvedValue(undefined);
    findPublicCharacterBySlug.mockResolvedValue({ id: 'char-1', slug: 'kim-masters' });
    getCharacterMetricsMap.mockResolvedValue(new Map([
      ['char-1', { creationsCount: 7, favoritesCount: 3, isFavorited: true }],
    ]));
  });

  it('rejects unauthorized catalog requests', async () => {
    requireMobileUserId.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    const res = await catalogRoute.GET(makeRequest('/api/mobile/character-catalog'));
    expect(res.status).toBe(401);
  });

  it('returns grouped catalog payload', async () => {
    listMobileCharacterCatalog.mockResolvedValue([{ id: 'brainrot', title: { en: 'Brainrot', ru: 'Брейнрот' }, subtitle: { en: '', ru: '' }, description: { en: '', ru: '' }, hiddenSearchText: { en: '', ru: '' }, characters: [] }]);
    const res = await catalogRoute.GET(makeRequest('/api/mobile/character-catalog', 'token'));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.categories).toHaveLength(1);
    expect(listMobileCharacterCatalog).toHaveBeenCalledWith('user-1');
  });

  it('returns character profile payload', async () => {
    getCharacterCatalogProfileBySlug.mockResolvedValue({ id: 'kim-masters', characterId: 'char-1', slug: 'kim-masters', name: 'Kim Masters', title: 'Kim Masters', tagline: 'Tag', bio: 'Bio', previewImageUrl: '/kim.png', previewVideoUrl: '/kim.mp4', previewVideoHasAudio: false, defaultVoiceId: 'voice-1', defaultVoiceProvider: 'elevenlabs', creationsCount: 2, favoritesCount: 9, isFavorited: true });
    const res = await profileRoute.GET(makeRequest('/api/mobile/characters/kim-masters', 'token'), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.slug).toBe('kim-masters');
    expect(payload.name).toBe('Kim Masters');
    expect(payload.title).toBe('Kim Masters');
    expect(getCharacterCatalogProfileBySlug).toHaveBeenCalledWith('kim-masters', { viewerUserId: 'user-1' });
  });

  it('returns 404 for unknown profiles', async () => {
    getCharacterCatalogProfileBySlug.mockResolvedValue(null);
    const res = await profileRoute.GET(makeRequest('/api/mobile/characters/missing', 'token'), { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
  });

  it('favorites a character and returns updated metrics', async () => {
    const res = await favoriteRoute.POST(makeRequest('/api/mobile/characters/kim-masters/favorite', 'token', 'POST'), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(favoriteCharacterForUser).toHaveBeenCalledWith('user-1', 'char-1');
    expect(payload.metrics).toEqual({ creationsCount: 7, favoritesCount: 3, isFavorited: true });
  });

  it('unfavorites a character and returns updated metrics', async () => {
    getCharacterMetricsMap.mockResolvedValue(new Map([
      ['char-1', { creationsCount: 7, favoritesCount: 2, isFavorited: false }],
    ]));
    const res = await favoriteRoute.DELETE(makeRequest('/api/mobile/characters/kim-masters/favorite', 'token', 'DELETE'), { params: Promise.resolve({ slug: 'kim-masters' }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(unfavoriteCharacterForUser).toHaveBeenCalledWith('user-1', 'char-1');
    expect(payload.metrics).toEqual({ creationsCount: 7, favoritesCount: 2, isFavorited: false });
  });

  it('returns 404 when trying to favorite a missing character', async () => {
    findPublicCharacterBySlug.mockResolvedValue(null);
    const res = await favoriteRoute.POST(makeRequest('/api/mobile/characters/missing/favorite', 'token', 'POST'), { params: Promise.resolve({ slug: 'missing' }) });
    expect(res.status).toBe(404);
  });
});
