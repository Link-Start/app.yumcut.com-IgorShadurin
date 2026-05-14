import type { Metadata } from 'next';
import { CharacterLanding } from '@/components/character/CharacterLanding';
import { getMainPageGroupById } from '@/components/character/main-page-groups';
import { getAuthSession } from '@/server/auth';
import { listCharacterCatalogGroups } from '@/server/character-catalog';

type SearchParams = {
  openCategory?: string | string[];
};
const TITLE_SUFFIX = 'Instant Viral Faceless Shorts Builder';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams?: Promise<SearchParams> }): Promise<Metadata> {
  const groups = await listCharacterCatalogGroups();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawOpenCategory = resolvedSearchParams?.openCategory;
  const openCategory = Array.isArray(rawOpenCategory) ? rawOpenCategory[0] : rawOpenCategory;
  const category = getMainPageGroupById(groups, openCategory);
  if (!category) {
    return {};
  }

  return {
    title: `${category.title.en} | ${TITLE_SUFFIX}`,
  };
}

export default async function Home({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getAuthSession();
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const groups = await listCharacterCatalogGroups(sessionUserId ?? null);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawOpenCategory = resolvedSearchParams?.openCategory;
  const openCategory = Array.isArray(rawOpenCategory) ? rawOpenCategory[0] : rawOpenCategory;
  const initialOpenCategoryId = getMainPageGroupById(groups, openCategory)?.id ?? null;

  return <CharacterLanding groups={groups} initialOpenCategoryId={initialOpenCategoryId} />;
}
