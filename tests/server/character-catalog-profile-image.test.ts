import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCharacterMetricsMap = vi.hoisted(() => vi.fn());
const getViewerFavoriteCreatedAtMap = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  characterCategory: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  character: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/server/db', () => ({ prisma }));
vi.mock('@/server/character-favorites', () => ({
  getCharacterMetricsMap,
  getViewerFavoriteCreatedAtMap,
  sortByFavoriteRecencyFirst: (items: any[]) => items,
}));
vi.mock('@/server/voices', () => ({
  listPublicVoices: vi.fn(),
}));

const catalog = await import('@/server/character-catalog');

describe('character catalog profile image URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.characterCategory.count.mockResolvedValue(1);
    prisma.characterCategory.findMany.mockResolvedValue([]);
    getCharacterMetricsMap.mockResolvedValue(new Map());
    getViewerFavoriteCreatedAtMap.mockResolvedValue(new Map());
  });

  it('keeps profile image URLs on the original source image, not the catalog preview variant', async () => {
    prisma.character.findFirst.mockResolvedValueOnce({
      id: 'ch-1',
      slug: 'matteo',
      name: 'Matteo',
      title: 'Matteo',
      tagline: null,
      description: 'Bio',
      bio: 'Bio',
      previewVideoUrl: null,
      previewVideoHasAudio: true,
      defaultVoiceId: null,
      defaultVoiceProvider: null,
      variations: [{
        id: 'var-1',
        imagePath: 'characters/source.webp',
        imageVariants: [{
          kind: 'catalog-preview',
          height: 896,
          status: 'ready',
          path: 'characters/variants/catalog-preview/h896/source.webp',
          url: null,
        }],
      }],
    });

    const profile = await catalog.getCharacterCatalogProfileBySlug('matteo');

    expect(profile?.previewImageUrl).toMatch(/\/api\/media\/characters\/source\.webp$/);
    expect(profile?.name).toBe('Matteo');
    expect(profile?.title).toBe('Matteo');
  });

  it('returns both name and title in mobile catalog items', async () => {
    prisma.characterCategory.findMany.mockResolvedValueOnce([{
      slug: 'brainrot',
      titleEn: 'Brainrot',
      titleRu: 'Брейнрот',
      subtitleEn: null,
      subtitleRu: null,
      descriptionEn: null,
      descriptionRu: null,
      searchTextEn: null,
      searchTextRu: null,
      characters: [{
        priority: 10,
        character: {
          id: 'ch-1',
          slug: 'matteo',
          name: 'Display Name',
          title: 'Internal Title',
          bio: 'Bio',
          description: 'Bio',
          searchTextEn: null,
          searchTextRu: null,
          previewVideoUrl: null,
          previewVideoHasAudio: true,
          defaultVoiceId: null,
          defaultVoiceProvider: null,
          variations: [{
            id: 'var-1',
            imagePath: 'characters/source.webp',
            imageVariants: [],
          }],
        },
      }],
    }]);
    getCharacterMetricsMap.mockResolvedValueOnce(new Map([
      ['ch-1', { creationsCount: 0, favoritesCount: 0, isFavorited: false }],
    ]));

    const groups = await catalog.listMobileCharacterCatalog('user-1');
    expect(groups[0]?.characters[0]?.name).toBe('Display Name');
    expect(groups[0]?.characters[0]?.title).toBe('Internal Title');
  });
});
