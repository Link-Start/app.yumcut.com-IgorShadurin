import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { CharacterProfilePage } from '@/components/character/CharacterProfilePage';
import { findPrimaryGroupIdByCharacterId, getMainPageGroupById } from '@/components/character/main-page-groups';
import { getAuthSession } from '@/server/auth';
import { getCharacterCatalogProfileBySlug, listCharacterCatalogGroups } from '@/server/character-catalog';

type Params = { id: string };
type SearchParams = Record<string, string | string[] | undefined>;
const TITLE_SUFFIX = 'Instant Viral Faceless Shorts Builder';
export const dynamic = 'force-dynamic';

function toUrlSearchParams(searchParams: SearchParams | undefined): URLSearchParams {
  const params = new URLSearchParams();
  if (!searchParams) return params;

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      }
      continue;
    }

    if (typeof value === 'string') {
      params.append(key, value);
    }
  }

  return params;
}

function isToolEntryRequest(searchParams: SearchParams | undefined): boolean {
  const params = toUrlSearchParams(searchParams);
  const hasPrefillParams = ['yc_t', 'yc_p', 'yc_l', 'yc_v', 'yc_d'].some((key) => params.has(key));
  const intent = params.get('intent')?.trim().toLowerCase() ?? '';
  const utmSource = params.get('utm_source')?.trim().toLowerCase() ?? '';

  return hasPrefillParams || intent === 'signup' || intent === 'signin' || utmSource.startsWith('yumcut-tool-');
}

function buildCharacterMetadataDescription(character: { name: string; bio?: string | null; tagline?: string | null }): string {
  const rawSummary = (character.bio ?? character.tagline ?? '').trim();
  const normalizedSummary = rawSummary.length > 0
    ? rawSummary.replace(/\s+/g, ' ')
    : `${character.name} is a ready-to-use AI character for short-form video creation.`;
  return `Create and generate AI videos with ${character.name}. ${normalizedSummary}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const character = await getCharacterCatalogProfileBySlug(id);
  if (!character) {
    return {};
  }

  const title = `Generate Videos with ${character.name} | ${TITLE_SUFFIX}`;
  const description = buildCharacterMetadataDescription(character);
  const previewImage = character.previewImageUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: previewImage, alt: `${character.name} preview image` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [previewImage],
    },
  };
}

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [session] = await Promise.all([
    getAuthSession(),
  ]);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const [character, groups] = await Promise.all([
    getCharacterCatalogProfileBySlug(id, { viewerUserId: sessionUserId ?? null }),
    listCharacterCatalogGroups(),
  ]);
  if (!character) {
    if (isToolEntryRequest(resolvedSearchParams)) {
      const paramsForRedirect = toUrlSearchParams(resolvedSearchParams);
      const query = paramsForRedirect.toString();
      redirect(query ? `/?${query}` : '/');
    }
    notFound();
  }

  const backCategoryId = findPrimaryGroupIdByCharacterId(groups, character.id);
  const backCategoryLabel = getMainPageGroupById(groups, backCategoryId)?.title.en ?? null;

  return (
    <CharacterProfilePage
      character={character}
      backCategoryId={backCategoryId}
      backCategoryLabel={backCategoryLabel}
      initialIsAuthenticated={Boolean(session?.user)}
      initialIsFavorited={character.isFavorited}
      initialFavoritesCount={character.favoritesCount}
      initialCreationsCount={character.creationsCount}
    />
  );
}
