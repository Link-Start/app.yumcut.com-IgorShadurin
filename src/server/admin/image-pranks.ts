import { prisma } from '@/server/db';
import {
  deleteStoredCatalogCharacterMedia,
  normalizeMediaUrl,
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

export type AdminImagePrankItemDTO = {
  id: string;
  categoryId: string;
  slug: string;
  titleEn: string;
  titleRu: string;
  descriptionEn: string | null;
  descriptionRu: string | null;
  imagePath: string;
  imageUrl: string | null;
  previewImageUrl: string | null;
  isPublic: boolean;
  priority: number;
  category: { id: string; slug: string; titleEn: string } | null;
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

function mapItem(item: any): AdminImagePrankItemDTO {
  return {
    id: item.id,
    categoryId: item.categoryId,
    slug: item.slug,
    titleEn: item.titleEn,
    titleRu: item.titleRu,
    descriptionEn: item.descriptionEn ?? null,
    descriptionRu: item.descriptionRu ?? null,
    imagePath: item.imagePath,
    imageUrl: item.imageUrl ?? null,
    previewImageUrl: item.imageUrl || normalizeMediaUrl(item.imagePath),
    isPublic: !!item.isPublic,
    priority: item.priority,
    category: item.category
      ? { id: item.category.id, slug: item.category.slug, titleEn: item.category.titleEn }
      : null,
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
  };
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
        select: { imagePath: true },
      },
    },
  });
  if (!existing) return;
  const paths = existing.items.map((item) => item.imagePath);
  await prisma.imagePrankCategory.delete({ where: { id } });
  if (deleteFiles) {
    await deleteStoredCatalogCharacterMedia(paths).catch(() => {});
  }
}

export async function listAdminImagePranks(input: {
  query?: string;
  categoryId?: string | null;
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

  const stored = await uploadCharacterAssetToStorage({
    file: input.image,
    fileName: input.image.name || `${slug}.png`,
    kind: 'character-image',
  });

  const description = input.description?.trim() || null;
  const searchText = input.searchText?.trim() || null;
  const created = await prisma.imagePrankItem.create({
    data: {
      categoryId: input.categoryId,
      slug,
      titleEn: title,
      titleRu: title,
      descriptionEn: description,
      descriptionRu: description,
      searchTextEn: searchText,
      searchTextRu: searchText,
      imagePath: stored.path,
      imageUrl: stored.url,
      isPublic: input.isPublic ?? false,
      priority: Number.isFinite(input.priority) ? Math.floor(input.priority as number) : 0,
    },
    include: {
      category: {
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
    select: { imagePath: true },
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
    const stored = await uploadCharacterAssetToStorage({
      file: input.image,
      fileName,
      kind: 'character-image',
    });
    data.imagePath = stored.path;
    data.imageUrl = stored.url;
  }

  const updated = await prisma.imagePrankItem.update({
    where: { id },
    data,
    include: {
      category: {
        select: { id: true, slug: true, titleEn: true },
      },
    },
  });

  if (input.image) {
    await deleteStoredCatalogCharacterMedia([existing.imagePath]).catch(() => {});
  }

  return mapItem(updated);
}

export async function deleteAdminImagePrankItem(id: string, deleteFiles: boolean): Promise<void> {
  const existing = await prisma.imagePrankItem.findUnique({
    where: { id },
    select: { imagePath: true },
  });
  if (!existing) return;
  await prisma.imagePrankItem.delete({ where: { id } });
  if (deleteFiles) {
    await deleteStoredCatalogCharacterMedia([existing.imagePath]).catch(() => {});
  }
}
