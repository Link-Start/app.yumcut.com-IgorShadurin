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
