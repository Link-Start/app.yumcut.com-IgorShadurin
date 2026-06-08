import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prepareCharacterPreviewImageVariantInStorage = vi.hoisted(() => vi.fn());
const normalizeMediaUrl = vi.hoisted(() => vi.fn((value: string | null | undefined) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://storage.test/api/media/${value.replace(/^\/+/, '')}`;
}));
const prisma = vi.hoisted(() => ({
  characterVariation: {
    findUnique: vi.fn(),
  },
  characterImageVariant: {
    upsert: vi.fn(),
  },
}));

vi.mock('@/server/db', () => ({ prisma }));
vi.mock('@/server/storage', () => ({
  normalizeMediaUrl,
  prepareCharacterPreviewImageVariantInStorage,
}));

const route = await import('@/app/api/characters/variations/[variationId]/preview-image/route');

function makeRequest(height = 896) {
  return new NextRequest(`http://localhost/api/characters/variations/var-1/preview-image?h=${height}`);
}

describe('character preview image variant route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalizeMediaUrl.mockImplementation((value: string | null | undefined) => {
      if (!value) return null;
      if (/^https?:\/\//i.test(value)) return value;
      return `https://storage.test/api/media/${value.replace(/^\/+/, '')}`;
    });
    prepareCharacterPreviewImageVariantInStorage.mockResolvedValue({
      path: 'characters/variants/catalog-preview/h896/generated.webp',
      url: 'https://storage.test/api/media/characters/variants/catalog-preview/h896/generated.webp',
      width: 504,
      height: 896,
    });
    prisma.characterImageVariant.upsert.mockResolvedValue({
      path: 'characters/variants/catalog-preview/h896/generated.webp',
      url: 'https://storage.test/api/media/characters/variants/catalog-preview/h896/generated.webp',
    });
  });

  it('rejects heights outside the allowlist', async () => {
    const res = await route.GET(makeRequest(512), { params: Promise.resolve({ variationId: 'var-1' }) });

    expect(res.status).toBe(400);
    expect(prisma.characterVariation.findUnique).not.toHaveBeenCalled();
  });

  it('redirects to an existing stored variant', async () => {
    prisma.characterVariation.findUnique.mockResolvedValueOnce({
      id: 'var-1',
      imagePath: 'characters/source.webp',
      character: { isCatalogPublic: true },
      imageVariants: [{ path: 'characters/variants/catalog-preview/h896/existing.webp', url: null }],
    });

    const res = await route.GET(makeRequest(), { params: Promise.resolve({ variationId: 'var-1' }) });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://storage.test/api/media/characters/variants/catalog-preview/h896/existing.webp');
    expect(prepareCharacterPreviewImageVariantInStorage).not.toHaveBeenCalled();
  });

  it('converts, stores, and redirects when the variant is missing', async () => {
    prisma.characterVariation.findUnique.mockResolvedValueOnce({
      id: 'var-1',
      imagePath: 'characters/source.webp',
      character: { isCatalogPublic: true },
      imageVariants: [],
    });

    const res = await route.GET(makeRequest(), { params: Promise.resolve({ variationId: 'var-1' }) });

    expect(res.status).toBe(307);
    expect(prepareCharacterPreviewImageVariantInStorage).toHaveBeenCalledWith({
      sourcePath: 'characters/source.webp',
      height: 896,
    });
    expect(prisma.characterImageVariant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        characterVariationId: 'var-1',
        kind: 'catalog-preview',
        height: 896,
        width: 504,
        path: 'characters/variants/catalog-preview/h896/generated.webp',
        status: 'ready',
      }),
    }));
    expect(res.headers.get('location')).toBe('https://storage.test/api/media/characters/variants/catalog-preview/h896/generated.webp');
  });

  it('returns 404 for private or missing variations', async () => {
    prisma.characterVariation.findUnique.mockResolvedValueOnce({
      id: 'var-1',
      imagePath: 'characters/source.webp',
      character: { isCatalogPublic: false },
      imageVariants: [],
    });

    const res = await route.GET(makeRequest(), { params: Promise.resolve({ variationId: 'var-1' }) });

    expect(res.status).toBe(404);
  });
});
