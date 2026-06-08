export const PROJECT_EXPERIENCES = ['story', 'character'] as const;

export type ProjectExperience = (typeof PROJECT_EXPERIENCES)[number];

export const DEFAULT_PROJECT_EXPERIENCE: ProjectExperience = 'story';

export function normalizeProjectExperience(value: unknown): ProjectExperience {
  return value === 'character' ? 'character' : DEFAULT_PROJECT_EXPERIENCE;
}
