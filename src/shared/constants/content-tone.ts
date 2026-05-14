export const CONTENT_TONES = ['neutral', 'playful', 'angry'] as const;

export type ContentTone = (typeof CONTENT_TONES)[number];

export const DEFAULT_CONTENT_TONE: ContentTone = 'neutral';

export function normalizeContentTone(value: unknown, fallback: ContentTone = DEFAULT_CONTENT_TONE): ContentTone {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return (CONTENT_TONES as readonly string[]).includes(normalized)
    ? (normalized as ContentTone)
    : fallback;
}
