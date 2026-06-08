export type CharacterCreationSettings = {
  addOverlay: boolean;
  watermarkEnabled: boolean;
  captionsEnabled: boolean;
  includeCallToAction: boolean;
};

export const DEFAULT_CHARACTER_CREATION_SETTINGS: CharacterCreationSettings = {
  addOverlay: false,
  watermarkEnabled: false,
  captionsEnabled: true,
  includeCallToAction: true,
};

export function normalizeCharacterCreationSettings(value: unknown): CharacterCreationSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CHARACTER_CREATION_SETTINGS };
  const raw = value as Record<string, unknown>;
  return {
    addOverlay: typeof raw.addOverlay === 'boolean' ? raw.addOverlay : DEFAULT_CHARACTER_CREATION_SETTINGS.addOverlay,
    watermarkEnabled: typeof raw.watermarkEnabled === 'boolean' ? raw.watermarkEnabled : DEFAULT_CHARACTER_CREATION_SETTINGS.watermarkEnabled,
    captionsEnabled: typeof raw.captionsEnabled === 'boolean' ? raw.captionsEnabled : DEFAULT_CHARACTER_CREATION_SETTINGS.captionsEnabled,
    includeCallToAction: typeof raw.includeCallToAction === 'boolean'
      ? raw.includeCallToAction
      : DEFAULT_CHARACTER_CREATION_SETTINGS.includeCallToAction,
  };
}
