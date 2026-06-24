import { prisma } from '@/server/db';
import sharp from 'sharp';
import {
  deleteStoredCatalogCharacterMedia,
  normalizeMediaUrl,
  prepareCharacterPreviewImageVariantInStorage,
  uploadCharacterAssetToStorage,
} from '@/server/storage';
import { slugify } from '@/server/admin/characters';

export type AdminImagePrankCategoryDTO = {
  id: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  subtitleEn: string | null;
  subtitleRu: string | null;
  isActive: boolean;
  priority: number;
};

export type AdminImagePrankSubcategoryDTO = {
  id: string;
  categoryId: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  subtitleEn: string | null;
  subtitleRu: string | null;
  isActive: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
};

export type AdminImagePrankItemDTO = {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  slug: string;
  titleEn: string;
  titleRu: string;
  descriptionEn: string | null;
  descriptionRu: string | null;
  imagePath: string;
  imageUrl: string | null;
  previewImagePath: string | null;
  previewImageUrl: string | null;
  isPublic: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
  subcategory: { id: string; slug: string; titleEn: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminImagePranksResult = {
  items: AdminImagePrankItemDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const MAX_CATALOG_IMAGE_DIMENSION = 2000;
const IMAGE_PRANK_PREVIEW_HEIGHT = 896;

function toIso(value: Date): string {
  return value.toISOString();
}

function clampPageSize(value: number | undefined): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 30;
  return Math.min(Math.max(base, 1), 200);
}

function clampPage(value: number | undefined): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(base, 1);
}

function mapCategory(category: AdminImagePrankCategoryDTO): AdminImagePrankCategoryDTO {
  return category;
}

function mapSubcategory(subcategory: any): AdminImagePrankSubcategoryDTO {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    slug: subcategory.slug,
    titleEn: subcategory.titleEn,
    titleRu: subcategory.titleRu,
    subtitleEn: subcategory.subtitleEn ?? null,
    subtitleRu: subcategory.subtitleRu ?? null,
    isActive: !!subcategory.isActive,
    priority: subcategory.priority,
    category: subcategory.category
      ? { id: subcategory.category.id, slug: subcategory.category.slug, titleEn: subcategory.category.titleEn }
      : null,
  };
}

function mapItem(item: any): AdminImagePrankItemDTO {
  return {
    id: item.id,
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId ?? null,
    slug: item.slug,
    titleEn: item.titleEn,
    titleRu: item.titleRu,
    descriptionEn: item.descriptionEn ?? null,
    descriptionRu: item.descriptionRu ?? null,
    imagePath: item.imagePath,
    imageUrl: item.imageUrl ?? null,
    previewImagePath: item.previewImagePath ?? null,
    previewImageUrl:
      item.previewImageUrl
      || normalizeMediaUrl(item.previewImagePath)
      || item.imageUrl
      || normalizeMediaUrl(item.imagePath),
    isPublic: !!item.isPublic,
    priority: item.priority,
    category: item.category
      ? { id: item.category.id, slug: item.category.slug, titleEn: item.category.titleEn }
      : null,
    subcategory: item.subcategory
      ? { id: item.subcategory.id, slug: item.subcategory.slug, titleEn: item.subcategory.titleEn }
      : null,
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
  };
}

function catalogImageOutput(file: File): { mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; extension: string } {
  if (file.type === 'image/png') return { mimeType: 'image/png', extension: 'png' };
  if (file.type === 'image/webp') return { mimeType: 'image/webp', extension: 'webp' };
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

function replaceFileExtension(fileName: string, extension: string) {
  const base = fileName.trim().replace(/\.[a-z0-9]+$/i, '') || 'image-prank';
  return `${base}.${extension}`;
}

async function prepareCatalogImageFile(file: File, fallbackName: string): Promise<File> {
  const input = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error('Unable to read image dimensions');

  const { mimeType, extension } = catalogImageOutput(file);
  const fileName = replaceFileExtension(file.name || fallbackName, extension);
  if (width <= MAX_CATALOG_IMAGE_DIMENSION && height <= MAX_CATALOG_IMAGE_DIMENSION) {
    return file.name === fileName && file.type === mimeType ? file : new File([new Uint8Array(input)], fileName, { type: mimeType });
  }

  let pipeline = sharp(input)
    .rotate()
    .resize({
      width: MAX_CATALOG_IMAGE_DIMENSION,
      height: MAX_CATALOG_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (mimeType === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (mimeType === 'image/webp') {
    pipeline = pipeline.webp({ quality: 95 });
  } else {
    pipeline = pipeline.jpeg({ quality: 94, mozjpeg: true });
  }

  const output = await pipeline.toBuffer();
  return new File([new Uint8Array(output)], fileName, { type: mimeType });
}

async function uploadImagePrankCatalogImage(file: File, fallbackName: string) {
  const preparedImage = await prepareCatalogImageFile(file, fallbackName);
  const original = await uploadCharacterAssetToStorage({
    file: preparedImage,
    fileName: preparedImage.name || fallbackName,
    kind: 'character-image',
  });

  try {
    const preview = await prepareCharacterPreviewImageVariantInStorage({
      sourcePath: original.path,
      height: IMAGE_PRANK_PREVIEW_HEIGHT,
    });
    return {
      imagePath: original.path,
      imageUrl: original.url,
      previewImagePath: preview.path,
      previewImageUrl: preview.url,
    };
  } catch (error) {
    await deleteStoredCatalogCharacterMedia([original.path]).catch(() => {});
    throw error;
  }
}

export async function listAdminImagePrankCategories(): Promise<AdminImagePrankCategoryDTO[]> {
  const items = await prisma.imagePrankCategory.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      subtitleEn: true,
      subtitleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return items.map(mapCategory);
}

export async function createAdminImagePrankCategory(input: {
  slug: string;
  title: string;
  subtitle?: string | null;
  isActive?: boolean;
  priority?: number;
}): Promise<AdminImagePrankCategoryDTO> {
  const slug = slugify(input.slug);
  const title = input.title.trim();
  const subtitle = input.subtitle?.trim() || null;
  if (!slug) throw new Error('Slug is required');
  if (!title) throw new Error('Title is required');

  const created = await prisma.imagePrankCategory.create({
    data: {
      slug,
      titleEn: title,
      titleRu: title,
      subtitleEn: subtitle,
      subtitleRu: subtitle,
      isActive: input.isActive ?? true,
      priority: Number.isFinite(input.priority) ? Math.floor(input.priority as number) : 0,
    },
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      subtitleEn: true,
      subtitleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return mapCategory(created);
}

export async function updateAdminImagePrankCategory(
  id: string,
  input: {
    slug?: string;
    title?: string;
    subtitle?: string | null;
    isActive?: boolean;
    priority?: number;
  },
): Promise<AdminImagePrankCategoryDTO> {
  const data: Record<string, unknown> = {};
  if (typeof input.slug === 'string') {
    const slug = slugify(input.slug);
    if (slug) data.slug = slug;
  }
  if (typeof input.title === 'string') {
    const title = input.title.trim();
    if (title) {
      data.titleEn = title;
      data.titleRu = title;
    }
  }
  if (input.subtitle === null || typeof input.subtitle === 'string') {
    const subtitle = input.subtitle?.trim() || null;
    data.subtitleEn = subtitle;
    data.subtitleRu = subtitle;
  }
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
  if (typeof input.priority === 'number' && Number.isFinite(input.priority)) data.priority = Math.floor(input.priority);

  const updated = await prisma.imagePrankCategory.update({
    where: { id },
    data,
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleRu: true,
      subtitleEn: true,
      subtitleRu: true,
      isActive: true,
      priority: true,
    },
  });
  return mapCategory(updated);
}

export async function deleteAdminImagePrankCategory(id: string, deleteFiles: boolean): Promise<void> {
  const existing = await prisma.imagePrankCategory.findUnique({
    where: { id },
    include: {
      items: {
        select: { imagePath: true, previewImagePath: true },
      },
    },
  });
  if (!existing) return;
  const paths = existing.items.flatMap((item) => [item.imagePath, item.previewImagePath]);
  await prisma.imagePrankCategory.delete({ where: { id } });
  if (deleteFiles) {
    await deleteStoredCatalogCharacterMedia(paths).catch(() => {});
  }
}

export async function listAdminImagePrankSubcategories(input?: {
  categoryId?: string | null;
}): Promise<AdminImagePrankSubcategoryDTO[]> {
  const items = await prisma.imagePrankSubcategory.findMany({
    where: input?.categoryId ? { categoryId: input.categoryId } : undefined,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });
  return items.map(mapSubcategory);
}

export async function createAdminImagePrankSubcategory(input: {
  categoryId: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  isActive?: boolean;
  priority?: number;
}): Promise<AdminImagePrankSubcategoryDTO> {
  const categoryId = input.categoryId.trim();
  const slug = slugify(input.slug);
  const title = input.title.trim();
  const subtitle = input.subtitle?.trim() || null;
  if (!categoryId) throw new Error('Category is required');
  if (!slug) throw new Error('Slug is required');
  if (!title) throw new Error('Title is required');

  const category = await prisma.imagePrankCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new Error('Category not found');

  const created = await prisma.imagePrankSubcategory.create({
    data: {
      categoryId,
      slug,
      titleEn: title,
      titleRu: title,
      subtitleEn: subtitle,
      subtitleRu: subtitle,
      isActive: input.isActive ?? true,
      priority: Number.isFinite(input.priority) ? Math.floor(input.priority as number) : 0,
    },
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });
  return mapSubcategory(created);
}

export async function updateAdminImagePrankSubcategory(
  id: string,
  input: {
    categoryId?: string;
    slug?: string;
    title?: string;
    subtitle?: string | null;
    isActive?: boolean;
    priority?: number;
  },
): Promise<AdminImagePrankSubcategoryDTO> {
  const data: Record<string, unknown> = {};
  if (typeof input.categoryId === 'string') {
    const categoryId = input.categoryId.trim();
    const category = await prisma.imagePrankCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new Error('Category not found');
    data.categoryId = categoryId;
  }
  if (typeof input.slug === 'string') {
    const slug = slugify(input.slug);
    if (slug) data.slug = slug;
  }
  if (typeof input.title === 'string') {
    const title = input.title.trim();
    if (title) {
      data.titleEn = title;
      data.titleRu = title;
    }
  }
  if (input.subtitle === null || typeof input.subtitle === 'string') {
    const subtitle = input.subtitle?.trim() || null;
    data.subtitleEn = subtitle;
    data.subtitleRu = subtitle;
  }
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive;
  if (typeof input.priority === 'number' && Number.isFinite(input.priority)) data.priority = Math.floor(input.priority);

  const updated = await prisma.imagePrankSubcategory.update({
    where: { id },
    data,
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });
  return mapSubcategory(updated);
}

export async function deleteAdminImagePrankSubcategory(id: string, deleteFiles: boolean): Promise<void> {
  const existing = await prisma.imagePrankSubcategory.findUnique({
    where: { id },
    include: {
      items: {
        select: { id: true, imagePath: true, previewImagePath: true },
      },
    },
  });
  if (!existing) return;

  if (deleteFiles) {
    const paths = existing.items.flatMap((item) => [item.imagePath, item.previewImagePath]);
    await prisma.imagePrankItem.deleteMany({ where: { subcategoryId: id } });
    await prisma.imagePrankSubcategory.delete({ where: { id } });
    await deleteStoredCatalogCharacterMedia(paths).catch(() => {});
    return;
  }

  await prisma.imagePrankSubcategory.delete({ where: { id } });
}

export async function listAdminImagePranks(input: {
  query?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<ListAdminImagePranksResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const query = input.query?.trim() || '';
  const where: any = {};

  if (input.categoryId) {
    where.categoryId = input.categoryId;
  }
  if (input.subcategoryId) {
    where.subcategoryId = input.subcategoryId;
  }
  if (query) {
    where.OR = [
      { slug: { contains: query } },
      { titleEn: { contains: query } },
      { titleRu: { contains: query } },
      { descriptionEn: { contains: query } },
      { descriptionRu: { contains: query } },
      { searchTextEn: { contains: query } },
      { searchTextRu: { contains: query } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.imagePrankItem.findMany({
      where,
      include: {
        category: {
          select: { id: true, slug: true, titleEn: true },
        },
        subcategory: {
          select: { id: true, slug: true, titleEn: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.imagePrankItem.count({ where }),
  ]);

  return {
    items: items.map(mapItem),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createAdminImagePrankItem(input: {
  categoryId: string;
  subcategoryId?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  searchText?: string | null;
  isPublic?: boolean;
  priority?: number;
  image: File;
}): Promise<AdminImagePrankItemDTO> {
  const slug = slugify(input.slug);
  const title = input.title.trim();
  if (!input.categoryId.trim()) throw new Error('Category is required');
  if (!slug) throw new Error('Slug is required');
  if (!title) throw new Error('Title is required');

  const category = await prisma.imagePrankCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) throw new Error('Category not found');
  if (input.subcategoryId) {
    const subcategory = await prisma.imagePrankSubcategory.findFirst({
      where: { id: input.subcategoryId, categoryId: input.categoryId },
      select: { id: true },
    });
    if (!subcategory) throw new Error('Subcategory not found');
  }

  const stored = await uploadImagePrankCatalogImage(input.image, `${slug}.png`);

  const description = input.description?.trim() || null;
  const searchText = input.searchText?.trim() || null;
  const created = await prisma.imagePrankItem.create({
    data: {
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId || null,
      slug,
      titleEn: title,
      titleRu: title,
      descriptionEn: description,
      descriptionRu: description,
      searchTextEn: searchText,
      searchTextRu: searchText,
      imagePath: stored.imagePath,
      imageUrl: stored.imageUrl,
      previewImagePath: stored.previewImagePath,
      previewImageUrl: stored.previewImageUrl,
      isPublic: input.isPublic ?? false,
      priority: Number.isFinite(input.priority) ? Math.floor(input.priority as number) : 0,
    },
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
      subcategory: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });
  return mapItem(created);
}

export async function updateAdminImagePrankItem(
  id: string,
  input: {
    categoryId?: string;
    subcategoryId?: string | null;
    slug?: string;
    title?: string;
    description?: string | null;
    searchText?: string | null;
    isPublic?: boolean;
    priority?: number;
    image?: File | null;
  },
): Promise<AdminImagePrankItemDTO> {
  const existing = await prisma.imagePrankItem.findUnique({
    where: { id },
    select: { categoryId: true, imagePath: true, previewImagePath: true },
  });
  if (!existing) throw new Error('Prank image not found');

  const data: Record<string, unknown> = {};
  if (typeof input.categoryId === 'string') {
    const category = await prisma.imagePrankCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) throw new Error('Category not found');
    data.categoryId = input.categoryId;
  }
  if (input.subcategoryId === null) {
    data.subcategoryId = null;
  } else if (typeof input.subcategoryId === 'string') {
    const categoryId = typeof data.categoryId === 'string' ? data.categoryId : existing.categoryId;
    const subcategory = await prisma.imagePrankSubcategory.findFirst({
      where: { id: input.subcategoryId, categoryId },
      select: { id: true },
    });
    if (!subcategory) throw new Error('Subcategory not found');
    data.subcategoryId = input.subcategoryId;
  } else if (typeof data.categoryId === 'string') {
    data.subcategoryId = null;
  }
  if (typeof input.slug === 'string') {
    const slug = slugify(input.slug);
    if (slug) data.slug = slug;
  }
  if (typeof input.title === 'string') {
    const title = input.title.trim();
    if (title) {
      data.titleEn = title;
      data.titleRu = title;
    }
  }
  if (input.description === null || typeof input.description === 'string') {
    const description = input.description?.trim() || null;
    data.descriptionEn = description;
    data.descriptionRu = description;
  }
  if (input.searchText === null || typeof input.searchText === 'string') {
    const searchText = input.searchText?.trim() || null;
    data.searchTextEn = searchText;
    data.searchTextRu = searchText;
  }
  if (typeof input.isPublic === 'boolean') data.isPublic = input.isPublic;
  if (typeof input.priority === 'number' && Number.isFinite(input.priority)) data.priority = Math.floor(input.priority);

  if (input.image) {
    const fileName = input.image.name || `${typeof data.slug === 'string' ? data.slug : id}.png`;
    const stored = await uploadImagePrankCatalogImage(input.image, fileName);
    data.imagePath = stored.imagePath;
    data.imageUrl = stored.imageUrl;
    data.previewImagePath = stored.previewImagePath;
    data.previewImageUrl = stored.previewImageUrl;
  }

  const updated = await prisma.imagePrankItem.update({
    where: { id },
    data,
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
      subcategory: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });

  if (input.image) {
    await deleteStoredCatalogCharacterMedia([existing.imagePath, existing.previewImagePath]).catch(() => {});
  }

  return mapItem(updated);
}

export async function deleteAdminImagePrankItem(id: string, deleteFiles: boolean): Promise<void> {
  const existing = await prisma.imagePrankItem.findUnique({
    where: { id },
    select: { imagePath: true, previewImagePath: true },
  });
  if (!existing) return;
  await prisma.imagePrankItem.delete({ where: { id } });
  if (deleteFiles) {
    await deleteStoredCatalogCharacterMedia([existing.imagePath, existing.previewImagePath]).catch(() => {});
  }
}
