import { Prisma } from '@prisma/client';
import {
  DEFAULT_CHARACTER_CREATION_SETTINGS,
  normalizeCharacterCreationSettings,
  type CharacterCreationSettings,
} from '@/shared/constants/character-creation-settings';

const USER_SETTINGS_FIELDS = new Set(
  ((Prisma as any).dmmf?.datamodel?.models?.find((model: any) => model.name === 'UserSettings')?.fields ?? [])
    .map((field: any) => field.name as string),
);

export const HAS_CHARACTER_CREATION_SETTINGS_FIELD = USER_SETTINGS_FIELDS.has('characterCreationSettings');

export function resolveCharacterCreationSettings(settingsRecord: any): CharacterCreationSettings {
  if (HAS_CHARACTER_CREATION_SETTINGS_FIELD) {
    return normalizeCharacterCreationSettings(settingsRecord?.characterCreationSettings ?? null);
  }

  const legacy = {
    addOverlay: typeof settingsRecord?.addOverlay === 'boolean'
      ? settingsRecord.addOverlay
      : DEFAULT_CHARACTER_CREATION_SETTINGS.addOverlay,
    watermarkEnabled: typeof settingsRecord?.watermarkEnabled === 'boolean'
      ? settingsRecord.watermarkEnabled
      : DEFAULT_CHARACTER_CREATION_SETTINGS.watermarkEnabled,
    captionsEnabled: typeof settingsRecord?.captionsEnabled === 'boolean'
      ? settingsRecord.captionsEnabled
      : DEFAULT_CHARACTER_CREATION_SETTINGS.captionsEnabled,
    includeCallToAction: typeof settingsRecord?.includeCallToAction === 'boolean'
      ? settingsRecord.includeCallToAction
      : DEFAULT_CHARACTER_CREATION_SETTINGS.includeCallToAction,
  };

  return normalizeCharacterCreationSettings(legacy);
}
