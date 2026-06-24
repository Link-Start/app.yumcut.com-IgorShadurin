import { prisma } from '@/server/db';
import { normalizeMediaUrl } from '@/server/storage';
import type {
  ImagePrankCatalogCategoryDTO,
  ImagePrankCatalogDTO,
  ImagePrankCatalogItemDTO,
  ImagePrankCatalogSubcategoryDTO,
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
    previewImagePath: string | null;
    previewImageUrl: string | null;
    categoryId: string;
    category: {
      slug: string;
      titleEn: string;
      titleRu: string;
    };
    subcategory: {
      id: string;
      slug: string;
      titleEn: string;
      titleRu: string;
    } | null;
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
    previewImageUrl:
      item.previewImageUrl
      || normalizeMediaUrl(item.previewImagePath)
      || item.imageUrl
      || normalizeMediaUrl(item.imagePath)
      || '',
    previewImagePath: item.previewImagePath,
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
    categoryTitle: localized(item.category.titleEn, item.category.titleRu),
    subcategoryId: item.subcategory?.id ?? null,
    subcategorySlug: item.subcategory?.slug ?? null,
    subcategoryTitle: item.subcategory
      ? localized(item.subcategory.titleEn, item.subcategory.titleRu)
      : null,
  };
}

function mapSubcategory(
  subcategory: {
    id: string;
    categoryId: string;
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
): ImagePrankCatalogSubcategoryDTO {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    slug: subcategory.slug,
    title: localized(subcategory.titleEn, subcategory.titleRu),
    subtitle: localized(subcategory.subtitleEn, subcategory.subtitleRu),
    description: localized(subcategory.descriptionEn, subcategory.descriptionRu),
    hiddenSearchText: localized(subcategory.searchTextEn, subcategory.searchTextRu),
    items: subcategory.items.map(mapItem),
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
    subcategories: Array<Parameters<typeof mapSubcategory>[0]>;
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
    subcategories: category.subcategories.map(mapSubcategory),
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
          subcategory: {
            select: {
              id: true,
              slug: true,
              titleEn: true,
              titleRu: true,
            },
          },
        },
      },
      subcategories: {
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
              subcategory: {
                select: {
                  id: true,
                  slug: true,
                  titleEn: true,
                  titleRu: true,
                },
              },
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
      subcategory: {
        select: {
          id: true,
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
      subcategory: {
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleRu: true,
        },
      },
    },
  });

  return item ? mapItem(item) : null;
}
