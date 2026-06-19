import { prisma } from '@/server/db';
import { normalizeMediaUrl } from '@/server/storage';
import type {
  ImagePrankCatalogCategoryDTO,
  ImagePrankCatalogDTO,
  ImagePrankCatalogItemDTO,
  LocalizedCatalogTextDTO,
} from '@/shared/types';

function localized(en?: string | null, ru?: string | null): LocalizedCatalogTextDTO {
  const english = en?.trim() ?? '';
  return {
    en: english,
    ru: ru?.trim() || english,
  };
}

function mapItem(
  item: {
    id: string;
    slug: string;
    titleEn: string;
    titleRu: string;
    descriptionEn: string | null;
    descriptionRu: string | null;
    searchTextEn: string | null;
    searchTextRu: string | null;
    imagePath: string;
    imageUrl: string | null;
    categoryId: string;
    category: {
      slug: string;
      titleEn: string;
      titleRu: string;
    };
  },
): ImagePrankCatalogItemDTO {
  return {
    id: item.id,
    slug: item.slug,
    title: localized(item.titleEn, item.titleRu),
    description: localized(item.descriptionEn, item.descriptionRu),
    hiddenSearchText: localized(item.searchTextEn, item.searchTextRu),
    imageUrl: item.imageUrl || normalizeMediaUrl(item.imagePath) || '',
    imagePath: item.imagePath,
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
    categoryTitle: localized(item.category.titleEn, item.category.titleRu),
  };
}

function mapCategory(
  category: {
    id: string;
    slug: string;
    titleEn: string;
    titleRu: string;
    subtitleEn: string | null;
    subtitleRu: string | null;
    descriptionEn: string | null;
    descriptionRu: string | null;
    searchTextEn: string | null;
    searchTextRu: string | null;
    items: Array<Parameters<typeof mapItem>[0]>;
  },
): ImagePrankCatalogCategoryDTO {
  return {
    id: category.id,
    slug: category.slug,
    title: localized(category.titleEn, category.titleRu),
    subtitle: localized(category.subtitleEn, category.subtitleRu),
    description: localized(category.descriptionEn, category.descriptionRu),
    hiddenSearchText: localized(category.searchTextEn, category.searchTextRu),
    items: category.items.map(mapItem),
  };
}

export async function listPublicImagePrankCatalog(): Promise<ImagePrankCatalogDTO> {
  const categories = await prisma.imagePrankCategory.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: {
      items: {
        where: { isPublic: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        include: {
          category: {
            select: {
              slug: true,
              titleEn: true,
              titleRu: true,
            },
          },
        },
      },
    },
  });

  return { categories: categories.map(mapCategory) };
}

export async function getPublicImagePrankItemBySlug(slug: string): Promise<ImagePrankCatalogItemDTO | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const item = await prisma.imagePrankItem.findFirst({
    where: {
      slug: normalizedSlug,
      isPublic: true,
      category: { isActive: true },
    },
    include: {
      category: {
        select: {
          slug: true,
          titleEn: true,
          titleRu: true,
        },
      },
    },
  });

  return item ? mapItem(item) : null;
}

export async function getPublicImagePrankItemById(id: string): Promise<ImagePrankCatalogItemDTO | null> {
  if (!id.trim()) return null;

  const item = await prisma.imagePrankItem.findFirst({
    where: {
      id,
      isPublic: true,
      category: { isActive: true },
    },
    include: {
      category: {
        select: {
          slug: true,
          titleEn: true,
          titleRu: true,
        },
      },
    },
  });

  return item ? mapItem(item) : null;
}
