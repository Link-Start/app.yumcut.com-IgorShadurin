import { LIMITS } from '@/shared/constants/limits';

export const IMAGE_PRANK_PROMPT_PREFILL_PARAM = 'yc_p';

export function normalizeImagePrankPromptPrefill(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/\0/g, '').trim();
  if (!normalized) return null;

  return Array.from(normalized).slice(0, LIMITS.promptMax).join('');
}
