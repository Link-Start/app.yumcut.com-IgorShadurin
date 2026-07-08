import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/shared/constants/limits';
import { normalizeImagePrankPromptPrefill } from '@/components/image-prank/image-prank-prefill';

describe('image prank prompt prefill', () => {
  it('trims useful prompt text', () => {
    expect(normalizeImagePrankPromptPrefill('  place this character in a courtyard  ')).toBe(
      'place this character in a courtyard',
    );
  });

  it('ignores empty or non-string values', () => {
    expect(normalizeImagePrankPromptPrefill('   ')).toBeNull();
    expect(normalizeImagePrankPromptPrefill(null)).toBeNull();
  });

  it('removes null bytes and caps text at the prompt limit', () => {
    const value = `abc\0${'x'.repeat(LIMITS.promptMax + 10)}`;

    expect(normalizeImagePrankPromptPrefill(value)).toHaveLength(LIMITS.promptMax);
    expect(normalizeImagePrankPromptPrefill(value)?.includes('\0')).toBe(false);
  });
});
