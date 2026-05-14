"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button-1';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination';
import { CharacterPreviewCard } from './CharacterPreviewCard';
import {
  getMainPageGroupById,
  pickLocalizedText,
  type MainPageGroup,
  type MainPageGroupCharacter,
} from './main-page-groups';
const CATEGORY_PREVIEW_SECTIONS = 10;
const MAX_CHARACTERS_PER_CATEGORY_PAGE = 18;

const COPY = {
  en: {
    heading: 'Ready to hit a million views?',
    subtitle: 'Pick a character for your viral video!',
    sectionTitle: 'Character Groups',
    membersLabel: 'Characters in this group',
    profileLabel: 'Open profile',
    groupDetails: 'Group details',
    searchPlaceholder: 'Search category or character...',
    matchingCategoriesLabel: 'Matching categories',
    matchingCharactersLabel: 'Matching characters',
    noResults: 'No categories or characters found.',
    categoriesBack: 'Categories',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    goTo: 'Go to page',
    go: 'Go',
  },
  ru: {
    heading: 'Готов набрать миллион просмотров?',
    subtitle: 'Выбери персонажа для своего хитового видео!',
    sectionTitle: 'Группы персонажей',
    membersLabel: 'Персонажи этой группы',
    profileLabel: 'Открыть профиль',
    groupDetails: 'Детали группы',
    searchPlaceholder: 'Поиск по категориям и персонажам...',
    matchingCategoriesLabel: 'Найденные категории',
    matchingCharactersLabel: 'Найденные персонажи',
    noResults: 'Категории или персонажи не найдены.',
    categoriesBack: 'Категории',
    previous: 'Назад',
    next: 'Вперёд',
    page: 'Страница',
    of: 'из',
    goTo: 'Перейти к странице',
    go: 'Перейти',
  },
} as const;

type LandingCopy = {
  heading: string;
  subtitle: string;
  sectionTitle: string;
  membersLabel: string;
  profileLabel: string;
  groupDetails: string;
  searchPlaceholder: string;
  matchingCategoriesLabel: string;
  matchingCharactersLabel: string;
  noResults: string;
  categoriesBack: string;
  previous: string;
  next: string;
  page: string;
  of: string;
  goTo: string;
  go: string;
};

type CharacterSearchRow = {
  key: string;
  character: MainPageGroupCharacter;
  groupId: string;
  groupLabel: string;
};

function buildSectionPreviewImages(images: string[]): string[] {
  const safeImages = images.length > 0 ? images : ['/template/basic/preview.jpg'];
  const source = safeImages.slice(0, CATEGORY_PREVIEW_SECTIONS);
  return Array.from(
    { length: CATEGORY_PREVIEW_SECTIONS },
    (_, index) => source[index % source.length] ?? source[0]!,
  );
}

function GroupSectionPreview({
  images,
  alt,
  activeSection,
}: {
  images: string[];
  alt: string;
  activeSection: number | null;
}) {
  const sectionImages = useMemo(() => buildSectionPreviewImages(images), [images]);
  const activeIndex = activeSection ?? 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
      {sectionImages.map((imageUrl, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${imageUrl}-${index}`}
          src={imageUrl}
          alt={alt}
          loading="lazy"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-out',
            index === activeIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]',
          )}
        />
      ))}
    </div>
  );
}

function toCardItem(character: MainPageGroupCharacter) {
  return {
    id: character.id,
    slug: character.slug,
    name: character.name,
    tagline: character.bio,
    bio: character.bio,
    previewImageUrl: character.imageUrl,
    previewVideoUrl: character.videoUrl,
    previewVideoHasAudio: character.videoHasAudio ?? true,
  };
}

function GroupCharacterVideoCard({
  character,
  profileLabel,
  groupLabel,
  isFavorited,
  favoriteSubmitting,
  onToggleFavorite,
}: {
  character: MainPageGroupCharacter;
  profileLabel: string;
  groupLabel?: string;
  isFavorited: boolean;
  favoriteSubmitting: boolean;
  onToggleFavorite: () => void;
}) {
  const cardItem = toCardItem(character);
  return (
    <div className="space-y-1">
      {groupLabel ? (
        <div className="truncate text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{groupLabel}</div>
      ) : null}
      <CharacterPreviewCard
        item={cardItem}
        href={`/character/${character.slug}`}
        className="rounded-2xl"
        showFavoriteButton
        isFavorited={isFavorited}
        favoriteSubmitting={favoriteSubmitting}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

function parsePositiveInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : null;
}

function GroupCategoryCard({
  group,
  selected,
  onSelect,
  language,
}: {
  group: MainPageGroup;
  selected: boolean;
  onSelect: () => void;
  language: 'en' | 'ru';
}) {
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const title = pickLocalizedText(group.title, language);
  const subtitle = pickLocalizedText(group.subtitle, language);
  const slideshowImages = useMemo(() => group.characters.map((character) => character.imageUrl), [group.characters]);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseLeave={() => setActiveSection(null)}
      onBlur={() => setActiveSection(null)}
      className="block w-full cursor-pointer text-left focus-visible:outline-none"
      aria-pressed={selected}
      aria-label={`Open ${title} group`}
    >
      <article
        className={cn(
          'group relative overflow-hidden rounded-2xl border bg-white transition-all duration-200',
          'focus-within:ring-2 focus-within:ring-blue-500',
          selected
            ? 'border-blue-300 shadow-[0_14px_28px_rgba(59,130,246,0.2)] dark:border-blue-700'
            : 'border-gray-200 dark:border-gray-800',
        )}
      >
        <div className="relative aspect-[9/16] w-full">
          <GroupSectionPreview images={slideshowImages} alt={title} activeSection={activeSection} />
          <div className="absolute inset-0 z-10 grid grid-cols-10">
            {Array.from({ length: CATEGORY_PREVIEW_SECTIONS }, (_, index) => (
              <span
                key={`${group.id}-preview-section-${index}`}
                className="h-full w-full"
                onMouseEnter={() => setActiveSection(index)}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h3 className="truncate text-sm font-semibold leading-none">{title}</h3>
          </div>
        </div>
      </article>
    </button>
  );
}

export function CharacterLanding({
  groups,
  initialOpenCategoryId = null,
}: {
  groups: MainPageGroup[];
  initialOpenCategoryId?: string | null;
}) {
  const { language } = useAppLanguage();
  const copy = COPY[language];
  const singleGroupId = groups.length === 1 ? groups[0]?.id ?? null : null;
  const hasSingleGroup = singleGroupId !== null;
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteStateBySlug, setFavoriteStateBySlug] = useState<Record<string, { isFavorited: boolean; favoritesCount: number }>>({});
  const [favoriteSubmittingBySlug, setFavoriteSubmittingBySlug] = useState<Record<string, boolean>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(
    () => getMainPageGroupById(groups, initialOpenCategoryId)?.id ?? singleGroupId,
  );
  const [expandedGroupPage, setExpandedGroupPage] = useState(1);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  useEffect(() => {
    const next: Record<string, { isFavorited: boolean; favoritesCount: number }> = {};
    for (const group of groups) {
      for (const character of group.characters) {
        next[character.slug] = {
          isFavorited: character.isFavorited,
          favoritesCount: character.favoritesCount,
        };
      }
    }
    setFavoriteStateBySlug(next);
  }, [groups]);

  const toggleFavoriteForCharacter = useCallback(async (character: MainPageGroupCharacter) => {
    const slug = character.slug;
    if (!slug || favoriteSubmittingBySlug[slug]) return;

    const current = favoriteStateBySlug[slug] ?? {
      isFavorited: character.isFavorited,
      favoritesCount: character.favoritesCount,
    };
    const nextFavorited = !current.isFavorited;
    const previous = current;

    setFavoriteSubmittingBySlug((prev) => ({ ...prev, [slug]: true }));
    setFavoriteStateBySlug((prev) => ({
      ...prev,
      [slug]: {
        isFavorited: nextFavorited,
        favoritesCount: Math.max((previous.favoritesCount || 0) + (nextFavorited ? 1 : -1), 0),
      },
    }));

    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(slug)}/favorite`, {
        method: nextFavorited ? 'POST' : 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Favorite request failed: ${response.status}`);
      }
      const payload = await response.json() as {
        metrics?: {
          favoritesCount?: number;
          isFavorited?: boolean;
        };
      };
      setFavoriteStateBySlug((prev) => ({
        ...prev,
        [slug]: {
          isFavorited: payload.metrics?.isFavorited ?? nextFavorited,
          favoritesCount: payload.metrics?.favoritesCount ?? previous.favoritesCount,
        },
      }));
    } catch (error) {
      console.error('Failed to toggle favorite character', error);
      setFavoriteStateBySlug((prev) => ({ ...prev, [slug]: previous }));
      toast.error('Failed to update favorite');
    } finally {
      setFavoriteSubmittingBySlug((prev) => ({ ...prev, [slug]: false }));
    }
  }, [favoriteStateBySlug, favoriteSubmittingBySlug]);

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groups;

    return groups.filter((group) => {
      const title = pickLocalizedText(group.title, language).toLowerCase();
      const subtitle = pickLocalizedText(group.subtitle, language).toLowerCase();
      const description = pickLocalizedText(group.description, language).toLowerCase();
      const hiddenSearchText = pickLocalizedText(group.hiddenSearchText, language).toLowerCase();
      const groupMatches =
        title.includes(normalizedSearch) ||
        subtitle.includes(normalizedSearch) ||
        description.includes(normalizedSearch) ||
        hiddenSearchText.includes(normalizedSearch);
      const characterMatches = group.characters.some((character) => {
        const characterHiddenSearchText = pickLocalizedText(character.hiddenSearchText, language).toLowerCase();
        return (
          character.name.toLowerCase().includes(normalizedSearch) ||
          character.bio.toLowerCase().includes(normalizedSearch) ||
          characterHiddenSearchText.includes(normalizedSearch)
        );
      });

      return groupMatches || characterMatches;
    });
  }, [groups, language, normalizedSearch]);

  const matchingCharacters = useMemo(() => {
    if (!normalizedSearch) return [] as CharacterSearchRow[];

    const rows: CharacterSearchRow[] = [];
    for (const group of groups) {
      const groupTitle = pickLocalizedText(group.title, language);
      const groupLower = groupTitle.toLowerCase();
      const groupMatches =
        groupLower.includes(normalizedSearch) ||
        pickLocalizedText(group.subtitle, language).toLowerCase().includes(normalizedSearch) ||
        pickLocalizedText(group.description, language).toLowerCase().includes(normalizedSearch) ||
        pickLocalizedText(group.hiddenSearchText, language).toLowerCase().includes(normalizedSearch);

      for (const character of group.characters) {
        const characterMatches =
          character.name.toLowerCase().includes(normalizedSearch) ||
          character.bio.toLowerCase().includes(normalizedSearch) ||
          pickLocalizedText(character.hiddenSearchText, language).toLowerCase().includes(normalizedSearch);
        if (groupMatches || characterMatches) {
          rows.push({
            key: `${group.id}:${character.slug}`,
            character,
            groupId: group.id,
            groupLabel: groupTitle,
          });
        }
      }
    }

    return rows;
  }, [groups, language, normalizedSearch]);

  const resolveExpandedStateFromSearchParams = useCallback((searchParams: URLSearchParams) => {
    const explicitGroupId = getMainPageGroupById(groups, searchParams.get('openCategory'))?.id ?? null;
    const groupId = explicitGroupId ?? singleGroupId;
    if (!groupId) {
      return { groupId: null, page: 1 };
    }
    const group = getMainPageGroupById(groups, groupId);
    const totalPages = Math.max(1, Math.ceil((group?.characters.length ?? 0) / MAX_CHARACTERS_PER_CATEGORY_PAGE));
    const parsedPage = parsePositiveInteger(searchParams.get('page')) ?? 1;
    return {
      groupId,
      page: Math.min(parsedPage, totalPages),
    };
  }, [groups, singleGroupId]);

  const expandedGroup = groups.find((group) => group.id === expandedGroupId) ?? null;
  const expandedGroupTotalPages = expandedGroup
    ? Math.max(1, Math.ceil(expandedGroup.characters.length / MAX_CHARACTERS_PER_CATEGORY_PAGE))
    : 1;
  const safeExpandedGroupPage = Math.min(expandedGroupPage, expandedGroupTotalPages);
  const expandedGroupCharacters = expandedGroup
    ? expandedGroup.characters.slice(
      (safeExpandedGroupPage - 1) * MAX_CHARACTERS_PER_CATEGORY_PAGE,
      safeExpandedGroupPage * MAX_CHARACTERS_PER_CATEGORY_PAGE,
    )
    : null;
  const showCategoriesView = expandedGroup === null && !hasSingleGroup;
  const showBackToCategories = expandedGroup !== null && !hasSingleGroup;

  const syncExpandedStateToUrl = useCallback((nextGroupId: string | null, nextPage: number, mode: 'push' | 'replace') => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (!nextGroupId) {
      url.searchParams.delete('openCategory');
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('openCategory', nextGroupId);
      if (nextPage > 1) {
        url.searchParams.set('page', String(nextPage));
      } else {
        url.searchParams.delete('page');
      }
    }

    url.hash = '';
    const nextUrl = `${url.pathname}${url.search}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;

    if (mode === 'replace') {
      window.history.replaceState({}, '', nextUrl || '/');
      return;
    }
    window.history.pushState({}, '', nextUrl || '/');
  }, []);

  const readExpandedStateFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return resolveExpandedStateFromSearchParams(new URLSearchParams());
    }
    const url = new URL(window.location.href);
    return resolveExpandedStateFromSearchParams(url.searchParams);
  }, [resolveExpandedStateFromSearchParams]);

  useEffect(() => {
    const { groupId, page } = readExpandedStateFromUrl();
    setExpandedGroupId(groupId);
    setExpandedGroupPage(page);
  }, [readExpandedStateFromUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const { groupId, page } = readExpandedStateFromUrl();
      setExpandedGroupId(groupId);
      setExpandedGroupPage(page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [readExpandedStateFromUrl]);

  useEffect(() => {
    if (!expandedGroup) {
      if (expandedGroupPage !== 1) {
        setExpandedGroupPage(1);
      }
      return;
    }
    if (expandedGroupPage > expandedGroupTotalPages) {
      const nextPage = expandedGroupTotalPages;
      setExpandedGroupPage(nextPage);
      syncExpandedStateToUrl(expandedGroup.id, nextPage, 'replace');
    }
  }, [expandedGroup, expandedGroupPage, expandedGroupTotalPages, syncExpandedStateToUrl]);

  const openExpandedGroup = useCallback((groupId: string) => {
    const validGroupId = getMainPageGroupById(groups, groupId)?.id ?? null;
    if (!validGroupId) return;
    setExpandedGroupId(validGroupId);
    setExpandedGroupPage(1);
    syncExpandedStateToUrl(validGroupId, 1, 'push');
  }, [groups, syncExpandedStateToUrl]);

  const goToExpandedGroupPage = useCallback((nextPage: number) => {
    if (!expandedGroup) return;
    const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), expandedGroupTotalPages);
    if (clampedPage === safeExpandedGroupPage) return;
    setExpandedGroupPage(clampedPage);
    syncExpandedStateToUrl(expandedGroup.id, clampedPage, 'push');
  }, [expandedGroup, expandedGroupTotalPages, safeExpandedGroupPage, syncExpandedStateToUrl]);

  const collapseExpandedGroup = () => {
    if (hasSingleGroup) return;
    setExpandedGroupId(null);
    setExpandedGroupPage(1);
    syncExpandedStateToUrl(null, 1, 'replace');
  };

  function buildPageItems(totalPages: number, currentPage: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      start = 2;
      end = 4;
    } else if (currentPage >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }

    if (start > 2) {
      items.push('ellipsis-left');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < totalPages - 1) {
      items.push('ellipsis-right');
    }

    items.push(totalPages);
    return items;
  }

  const renderExpandedGroupPagination = (position: 'top' | 'bottom') => (
    <Pagination className={cn(position === 'top' ? 'mb-4' : 'mt-4')}>
      <PaginationContent className="w-full flex-wrap justify-center gap-1 sm:gap-1.5">
        <PaginationItem>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-10 px-4 text-sm disabled:cursor-not-allowed"
            onClick={() => goToExpandedGroupPage(safeExpandedGroupPage - 1)}
            disabled={safeExpandedGroupPage <= 1}
          >
            <ChevronLeft className="rtl:rotate-180 h-4 w-4" />
            {copy.previous}
          </Button>
        </PaginationItem>

        {buildPageItems(expandedGroupTotalPages, safeExpandedGroupPage).map((item) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <PaginationItem key={`${position}-${item}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          const page = item;
          const isActive = page === safeExpandedGroupPage;
          return (
            <PaginationItem key={`${position}-page-${page}`}>
              <Button
                type="button"
                variant={isActive ? 'outline' : 'ghost'}
                mode="icon"
                size="lg"
                className="h-10 w-10 text-sm"
                onClick={() => goToExpandedGroupPage(page)}
                aria-current={isActive ? 'page' : undefined}
              >
                {page}
              </Button>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-10 px-4 text-sm disabled:cursor-not-allowed"
            onClick={() => goToExpandedGroupPage(safeExpandedGroupPage + 1)}
            disabled={safeExpandedGroupPage >= expandedGroupTotalPages}
          >
            {copy.next}
            <ChevronRight className="rtl:rotate-180 h-4 w-4" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-14 sm:px-4 lg:px-0">
      <div className="mb-8 text-center">
        <h1 className="text-pretty text-center font-semibold tracking-tighter text-gray-900 dark:text-gray-100 sm:text-[32px] md:text-[46px] text-[29px]">
          {copy.heading}
        </h1>
        <p className="mt-1 mb-2 text-center text-[clamp(12px,3.5vw,20px)] sm:text-[20px] text-gray-600 dark:text-gray-300 whitespace-normal text-pretty leading-tight tracking-tight">
          {copy.subtitle}
        </p>
      </div>

      <section aria-label="Character groups" className="space-y-4">
        <div className={cn('flex min-h-10 items-center', showBackToCategories ? 'gap-2' : 'gap-0')}>
          <button
            type="button"
            onClick={collapseExpandedGroup}
            className={cn(
              'inline-flex h-9 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium text-blue-700 transition-[width,opacity,transform,margin,padding,border] duration-200 ease-out dark:text-blue-300',
              showBackToCategories
                ? 'pointer-events-auto mr-2 w-36 cursor-pointer border border-blue-200/80 bg-white/80 px-3 opacity-100 translate-x-0 shadow-sm backdrop-blur-sm hover:border-blue-300 hover:text-blue-800 dark:border-blue-800/80 dark:bg-gray-950/70 dark:hover:border-blue-700 dark:hover:text-blue-200'
                : 'pointer-events-none mr-0 h-0 min-h-0 w-0 min-w-0 cursor-default border-0 px-0 opacity-0 -translate-x-2 sm:h-0 sm:min-h-0 sm:w-0 sm:min-w-0',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{copy.categoriesBack}</span>
          </button>

          <div className="relative w-full transition-all duration-200 ease-out">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-10 pl-9"
              aria-label={copy.searchPlaceholder}
            />
          </div>
        </div>

        <div className="relative">
          <div
            className={cn(
              'space-y-4 transition-[opacity,transform] duration-180 ease-out will-change-transform',
              showCategoriesView
                ? 'relative opacity-100 translate-y-0 scale-100'
                : 'pointer-events-none absolute inset-0 opacity-0 -translate-y-1 scale-[0.995]',
            )}
          >
            {normalizedSearch && matchingCharacters.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{copy.matchingCharactersLabel}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {matchingCharacters.map((row) => (
                    <GroupCharacterVideoCard
                      key={row.key}
                      character={row.character}
                      profileLabel={copy.profileLabel}
                      groupLabel={row.groupLabel}
                      isFavorited={(favoriteStateBySlug[row.character.slug] ?? {
                        isFavorited: row.character.isFavorited,
                        favoritesCount: row.character.favoritesCount,
                      }).isFavorited}
                      favoriteSubmitting={favoriteSubmittingBySlug[row.character.slug] === true}
                      onToggleFavorite={() => void toggleFavoriteForCharacter(row.character)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {normalizedSearch ? (
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{copy.matchingCategoriesLabel}</div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {filteredGroups.map((group) => (
                <GroupCategoryCard
                  key={group.id}
                  group={group}
                  selected={expandedGroupId === group.id}
                  onSelect={() => openExpandedGroup(group.id)}
                  language={language}
                />
              ))}
            </div>

            {normalizedSearch && filteredGroups.length === 0 && matchingCharacters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                {copy.noResults}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'transition-[opacity,transform] duration-180 ease-out will-change-transform',
              expandedGroup
                ? 'relative opacity-100 translate-y-0 scale-100'
                : 'pointer-events-none absolute inset-0 opacity-0 translate-y-1 scale-[0.995]',
            )}
          >
            {expandedGroup && expandedGroupTotalPages > 1 ? renderExpandedGroupPagination('top') : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {expandedGroup && expandedGroupCharacters
                ? expandedGroupCharacters.map((character) => (
                  <GroupCharacterVideoCard
                    key={character.id}
                    character={character}
                    profileLabel={copy.profileLabel}
                    isFavorited={(favoriteStateBySlug[character.slug] ?? {
                      isFavorited: character.isFavorited,
                      favoritesCount: character.favoritesCount,
                    }).isFavorited}
                    favoriteSubmitting={favoriteSubmittingBySlug[character.slug] === true}
                    onToggleFavorite={() => void toggleFavoriteForCharacter(character)}
                  />
                ))
                : null}
            </div>
            {expandedGroup && expandedGroupTotalPages > 1 ? renderExpandedGroupPagination('bottom') : null}
          </div>
        </div>
      </section>
    </div>
  );
}
