import type { Metadata } from 'next';
import { CharacterLanding } from '@/components/character/CharacterLanding';
import {
  getMainPageGroupById,
  resolveInitialMainPageTopLevelMode,
} from '@/components/character/main-page-groups';
import { getAuthSession } from '@/server/auth';
import { listCharacterCatalogGroups } from '@/server/character-catalog';
import { listPublicImagePrankCatalog } from '@/server/image-pranks';

type SearchParams = {
  openMode?: string | string[];
  openCategory?: string | string[];
};
const TITLE_SUFFIX = 'Instant Viral Faceless Shorts Builder';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }): Promise<Metadata> {
  const groups = await listCharacterCatalogGroups();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawOpenMode = resolvedSearchParams?.openMode;
  const openMode = Array.isArray(rawOpenMode) ? rawOpenMode[0] : rawOpenMode;
  const rawOpenCategory = resolvedSearchParams?.openCategory;
  const openCategory = Array.isArray(rawOpenCategory) ? rawOpenCategory[0] : rawOpenCategory;
  const category = getMainPageGroupById(groups, openCategory);
  const initialOpenMode = resolveInitialMainPageTopLevelMode({
    openMode,
    hasOpenCategory: category !== null,
  });
  if (initialOpenMode === 'image-prank') {
    return {
      title: `Image Prank | ${TITLE_SUFFIX}`,
    };
  }
  if (initialOpenMode === 'stories') {
    return {
      title: `Stories | ${TITLE_SUFFIX}`,
    };
  }
  if (!category) {
    if (initialOpenMode === 'brainrot') {
      return {
        title: `Brainrot | ${TITLE_SUFFIX}`,
      };
    }
    return {};
  }

  return {
    title: `${category.title.en} | ${TITLE_SUFFIX}`,
  };
}

export default async function Home({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getAuthSession();
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const [groups, imagePrankCatalog] = await Promise.all([
    listCharacterCatalogGroups(sessionUserId ?? null),
    listPublicImagePrankCatalog().catch((error) => {
      console.error('Failed to load image prank catalog for home page', error);
      return { categories: [] };
    }),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawOpenMode = resolvedSearchParams?.openMode;
  const openMode = Array.isArray(rawOpenMode) ? rawOpenMode[0] : rawOpenMode;
  const rawOpenCategory = resolvedSearchParams?.openCategory;
  const openCategory = Array.isArray(rawOpenCategory) ? rawOpenCategory[0] : rawOpenCategory;
  const initialOpenCategoryId = getMainPageGroupById(groups, openCategory)?.id ?? null;
  const initialOpenMode = resolveInitialMainPageTopLevelMode({
    openMode,
    hasOpenCategory: initialOpenCategoryId !== null,
  });

  return (
    <CharacterLanding
      groups={groups}
      imagePrankCategories={imagePrankCatalog.categories}
      initialOpenMode={initialOpenMode}
      initialOpenCategoryId={initialOpenCategoryId}
    />
  );
}
