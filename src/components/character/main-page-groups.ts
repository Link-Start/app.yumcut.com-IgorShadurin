import type { AppLanguageCode } from '@/shared/constants/app-language';

export type LocalizedText = {
  en: string;
  ru: string;
};

export type MainPageGroupCharacter = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  weight?: number;
  hiddenSearchText: LocalizedText;
  imageUrl: string;
  videoUrl?: string | null;
  videoHasAudio?: boolean;
  defaultVoiceId?: string | null;
  defaultVoiceProvider?: string | null;
  creationsCount: number;
  favoritesCount: number;
  isFavorited: boolean;
};

export type MainPageGroup = {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  description: LocalizedText;
  weight?: number;
  hiddenSearchText: LocalizedText;
  characters: MainPageGroupCharacter[];
};

export type MainPageCharacterSearchRow = {
  key: string;
  character: MainPageGroupCharacter;
  groupId: string;
  groupLabel: string;
};

export type MainPageLandingView = 'search' | 'categories' | 'expanded';
export type MainPageTopLevelMode = 'image-prank' | 'stories' | 'brainrot';

const MAIN_PAGE_IMAGE_SEARCH_TEXT: Record<AppLanguageCode, string> = {
  en: 'image prank images prank image generation picture photo prompt still ai image custom mix',
  ru: 'image prank картинка prank картинки изображение изображения генерация изображения фото промпт свой микс',
};

const MAIN_PAGE_STORIES_SEARCH_TEXT: Record<AppLanguageCode, string> = {
  en: 'stories story old story classic story script idea prompt video templates',
  ru: 'истории история старые истории классическая история сценарий идея промпт видео шаблоны',
};

export function normalizeMainPageTopLevelMode(value: string | null | undefined): MainPageTopLevelMode | null {
  if (value === 'image' || value === 'image-prank') return 'image-prank';
  if (value === 'stories' || value === 'brainrot') return value;
  return null;
}

export function resolveInitialMainPageTopLevelMode(input: {
  openMode: string | null | undefined;
  hasOpenCategory: boolean;
}): MainPageTopLevelMode | null {
  const explicit = normalizeMainPageTopLevelMode(input.openMode);
  if (explicit) return explicit;
  return input.hasOpenCategory ? 'brainrot' : null;
}

export function normalizeWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function sortMainPageGroups(
  groups: MainPageGroup[],
  options?: { preserveCharacterOrder?: boolean },
): MainPageGroup[] {
  const preserveCharacterOrder = options?.preserveCharacterOrder === true;
  return [...groups]
    .map((group, groupIndex) => {
      const normalizedCharacters = [...group.characters].map((character) => ({
        ...character,
        weight: normalizeWeight(character.weight),
      })) as MainPageGroupCharacter[];
      const characters = preserveCharacterOrder
        ? normalizedCharacters
        : normalizedCharacters
          .map((character, characterIndex) => ({
            character,
            characterIndex,
          }))
          .sort((a, b) => {
            const weightDiff = normalizeWeight(b.character.weight) - normalizeWeight(a.character.weight);
            if (weightDiff !== 0) return weightDiff;
            return a.characterIndex - b.characterIndex;
          })
          .map((entry) => entry.character);

      return {
        group: {
          ...group,
          weight: normalizeWeight(group.weight),
          characters,
        } as MainPageGroup,
        groupIndex,
      };
    })
    .sort((a, b) => {
      const weightDiff = normalizeWeight(b.group.weight) - normalizeWeight(a.group.weight);
      if (weightDiff !== 0) return weightDiff;
      return a.groupIndex - b.groupIndex;
    })
    .map((entry) => entry.group);
}

export function pickLocalizedText(value: LocalizedText, language: AppLanguageCode): string {
  return language === 'ru' ? value.ru : value.en;
}

export function normalizeMainPageSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function mainPageStoriesMatchesSearch(
  normalizedSearch: string,
  language: AppLanguageCode,
): boolean {
  if (!normalizedSearch) return true;
  return MAIN_PAGE_STORIES_SEARCH_TEXT[language].includes(normalizedSearch);
}

export function mainPageImageMatchesSearch(
  normalizedSearch: string,
  language: AppLanguageCode,
): boolean {
  if (!normalizedSearch) return true;
  return MAIN_PAGE_IMAGE_SEARCH_TEXT[language].includes(normalizedSearch);
}

export function mainPageGroupMatchesSearch(
  group: MainPageGroup,
  normalizedSearch: string,
  language: AppLanguageCode,
): boolean {
  if (!normalizedSearch) return true;
  return (
    pickLocalizedText(group.title, language).toLowerCase().includes(normalizedSearch) ||
    pickLocalizedText(group.subtitle, language).toLowerCase().includes(normalizedSearch) ||
    pickLocalizedText(group.description, language).toLowerCase().includes(normalizedSearch) ||
    pickLocalizedText(group.hiddenSearchText, language).toLowerCase().includes(normalizedSearch)
  );
}

export function mainPageCharacterMatchesSearch(
  character: MainPageGroupCharacter,
  normalizedSearch: string,
  language: AppLanguageCode,
): boolean {
  if (!normalizedSearch) return true;
  return (
    character.name.toLowerCase().includes(normalizedSearch) ||
    character.bio.toLowerCase().includes(normalizedSearch) ||
    pickLocalizedText(character.hiddenSearchText, language).toLowerCase().includes(normalizedSearch)
  );
}

export function filterMainPageGroupsForSearch(
  groups: MainPageGroup[],
  normalizedSearch: string,
  language: AppLanguageCode,
): MainPageGroup[] {
  if (!normalizedSearch) return groups;
  return groups.filter((group) => (
    mainPageGroupMatchesSearch(group, normalizedSearch, language) ||
    group.characters.some((character) => mainPageCharacterMatchesSearch(character, normalizedSearch, language))
  ));
}

export function findMainPageMatchingCharacters(
  groups: MainPageGroup[],
  normalizedSearch: string,
  language: AppLanguageCode,
): MainPageCharacterSearchRow[] {
  if (!normalizedSearch) return [];

  const rows: MainPageCharacterSearchRow[] = [];
  for (const group of groups) {
    const groupTitle = pickLocalizedText(group.title, language);
    const groupMatches = mainPageGroupMatchesSearch(group, normalizedSearch, language);

    for (const character of group.characters) {
      if (groupMatches || mainPageCharacterMatchesSearch(character, normalizedSearch, language)) {
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
}

export function resolveMainPageLandingView(input: {
  isSearchActive: boolean;
  hasExpandedGroup: boolean;
  hasSingleGroup: boolean;
}): MainPageLandingView {
  if (input.isSearchActive) return 'search';
  if (input.hasExpandedGroup) return 'expanded';
  if (!input.hasSingleGroup) return 'categories';
  return 'expanded';
}

export function getMainPageGroupById(groups: MainPageGroup[], groupId: string | null | undefined): MainPageGroup | null {
  if (!groupId) return null;
  return groups.find((group) => group.id === groupId) ?? null;
}

export function findPrimaryGroupIdByCharacterId(groups: MainPageGroup[], characterId: string): string | null {
  for (const group of groups) {
    if (group.characters.some((character) => character.id === characterId || character.slug === characterId)) {
      return group.id;
    }
  }
  return null;
}
