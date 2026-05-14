import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadCharacterAssetToStorage = vi.hoisted(() => vi.fn());
const deleteStoredCatalogCharacterMedia = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
  character: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  characterCategory: {
    findUnique: vi.fn(),
  },
  characterCategoryCharacter: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
}));

const tx = vi.hoisted(() => ({
  character: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  characterVariation: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  characterCategoryCharacter: {
    create: vi.fn(),
  },
}));

vi.mock('@/server/db', () => ({ prisma }));
vi.mock('@/server/storage', () => ({
  uploadCharacterAssetToStorage,
  deleteStoredCatalogCharacterMedia,
  normalizeMediaUrl: (value: string | null | undefined) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://storage.test/api/media/${value.replace(/^\/+/, '')}`;
  },
}));

const adminCharacters = await import('@/server/admin/characters');

describe('admin character storage-backed assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (arg: any) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(tx);
    });
    prisma.characterCategory.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'brainrot' });
    prisma.characterCategoryCharacter.findFirst.mockResolvedValue(null);
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.character.count.mockResolvedValue(1);
    prisma.characterCategoryCharacter.count.mockResolvedValue(1);
    tx.character.create.mockResolvedValue({ id: 'ch-1', priority: 42 });
    tx.characterVariation.create.mockResolvedValue({ id: 'var-1' });
    tx.characterCategoryCharacter.create.mockResolvedValue({});
    tx.characterVariation.deleteMany.mockResolvedValue({ count: 1 });
    tx.character.delete.mockResolvedValue({});
    uploadCharacterAssetToStorage
      .mockResolvedValueOnce({ path: 'characters/catalog/prepared.webp', url: 'https://storage.test/api/media/characters/catalog/prepared.webp' })
      .mockResolvedValueOnce({ path: 'characters/catalog/empty.webp', url: 'https://storage.test/api/media/characters/catalog/empty.webp' });
    deleteStoredCatalogCharacterMedia.mockResolvedValue(undefined);
  });

  it('imports catalog images through storage and stores returned paths', async () => {
    const result = await adminCharacters.importAdminCharacter({
      categoryId: 'cat-1',
      slug: 'Matteo',
      name: 'Matteo',
      title: 'Matteo',
      bio: 'bio',
      isPublic: true,
      preparedFile: new File([new Uint8Array([1])], 'prepared.webp', { type: 'image/webp' }),
      emptyFile: new File([new Uint8Array([2])], 'empty.webp', { type: 'image/webp' }),
    });

    expect(result).toEqual({ status: 'saved', characterId: 'ch-1' });
    expect(uploadCharacterAssetToStorage).toHaveBeenCalledTimes(2);
    expect(uploadCharacterAssetToStorage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      fileName: 'brainrot-matteo-prepared.webp',
      kind: 'character-image',
    }));
    expect(uploadCharacterAssetToStorage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      fileName: 'brainrot-matteo-empty.webp',
      kind: 'character-image',
    }));
    expect(tx.characterVariation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imagePath: 'characters/catalog/prepared.webp',
        emptyImagePath: 'characters/catalog/empty.webp',
      }),
    });
  });

  it('uploads preview videos through storage and deletes the previous stored video', async () => {
    uploadCharacterAssetToStorage.mockReset().mockResolvedValueOnce({
      path: 'characters/catalog/preview.mp4',
      url: 'https://storage.test/api/media/characters/catalog/preview.mp4',
    });
    prisma.character.findUnique.mockResolvedValueOnce({
      id: 'ch-1',
      slug: 'Matteo',
      previewVideoUrl: 'characters/catalog/old-preview.mp4',
      categories: [{ category: { slug: 'brainrot' } }],
    });
    prisma.character.update.mockResolvedValue({});

    const result = await adminCharacters.uploadAdminCharacterPreviewVideo({
      id: 'ch-1',
      videoFile: new File([new Uint8Array([1, 2, 3])], 'preview.mp4', { type: 'video/mp4' }),
      extension: 'mp4',
      hasAudio: false,
    });

    expect(result).toEqual({ previewVideoUrl: 'https://storage.test/api/media/characters/catalog/preview.mp4' });
    expect(uploadCharacterAssetToStorage).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'brainrot-matteo-preview.mp4',
      kind: 'video',
    }));
    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { id: 'ch-1' },
      data: {
        previewVideoUrl: 'characters/catalog/preview.mp4',
        previewVideoHasAudio: false,
      },
    });
    expect(deleteStoredCatalogCharacterMedia).toHaveBeenCalledWith(['characters/catalog/old-preview.mp4']);
  });

  it('maps admin list asset paths through storage URLs', async () => {
    prisma.character.findMany.mockResolvedValueOnce([{ id: 'ch-1', slug: 'matteo', name: 'Matteo', title: 'Matteo', bio: null, description: null, isCatalogPublic: true, priority: 1, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'), previewVideoUrl: 'characters/catalog/preview.mp4', previewVideoHasAudio: true, variations: [{ imagePath: 'characters/catalog/prepared.webp', emptyImagePath: 'characters/catalog/empty.webp' }], categories: [{ category: { id: 'cat-1', slug: 'brainrot', titleEn: 'Brainrot' } }] }]);

    const result = await adminCharacters.listAdminCharacters();

    expect(result.items[0]).toEqual(expect.objectContaining({
      preparedImageUrl: 'https://storage.test/api/media/characters/catalog/prepared.webp',
      emptyImageUrl: 'https://storage.test/api/media/characters/catalog/empty.webp',
      previewVideoUrl: 'https://storage.test/api/media/characters/catalog/preview.mp4',
    }));
  });

  it('deletes stored images and preview videos when deleting catalog files', async () => {
    prisma.character.findUnique.mockResolvedValueOnce({
      previewVideoUrl: 'characters/catalog/preview.mp4',
      variations: [{ imagePath: 'characters/catalog/prepared.webp', emptyImagePath: 'characters/catalog/empty.webp' }],
    });

    await adminCharacters.softDeleteAdminCharacter('ch-1', true);

    expect(deleteStoredCatalogCharacterMedia).toHaveBeenCalledWith([
      'characters/catalog/preview.mp4',
      'characters/catalog/prepared.webp',
      'characters/catalog/empty.webp',
    ]);
  });
});
