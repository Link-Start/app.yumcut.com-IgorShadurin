export const PROJECT_EXPERIENCES = ['story', 'character', 'rigger-animation'] as const;

export type ProjectExperience = (typeof PROJECT_EXPERIENCES)[number];

export const DEFAULT_PROJECT_EXPERIENCE: ProjectExperience = 'story';

export function normalizeProjectExperience(value: unknown): ProjectExperience {
  if (value === 'character' || value === 'rigger-animation') return value;
  return DEFAULT_PROJECT_EXPERIENCE;
}
