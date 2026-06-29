import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_PRANK_GENERATION_MODEL,
  IMAGE_PRANK_TWO_REFERENCE_MODELS,
  IMAGE_PRANK_UI_MODEL_OPTIONS,
  imagePrankGenerationDimensions,
  imagePrankGenerationDimensionsForAspect,
} from '@/shared/constants/image-generation';
import {
  getImagePrankModelCostMetadata,
  getSelectableImagePrankModelCostMetadata,
  listInternalImagePrankModelCosts,
  listInternalSelectableImagePrankModelCosts,
} from '@/server/image-generation/model-costs';

describe('image prank internal model costs', () => {
  it('stores private cost metadata for every supported two-reference model', () => {
    const costs = listInternalImagePrankModelCosts();
    expect(costs).toHaveLength(IMAGE_PRANK_TWO_REFERENCE_MODELS.length);

    for (const model of IMAGE_PRANK_TWO_REFERENCE_MODELS) {
      const metadata = getImagePrankModelCostMetadata(model);
      expect(metadata.model).toBe(model);
      expect(metadata.currency).toBe('USD');
      expect(metadata.unit).toBe('image_generation');
      expect(metadata.source).toBe('runware_response_cost');
      expect(metadata.estimatedCostUsd).toBeGreaterThan(0);
      expect(metadata.evidence).toContain('image-mix-model-test-final-2026-06-26T16-53-10/summary.json');
      expect(metadata.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('covers every user-selectable image prank model', () => {
    const selectableCosts = listInternalSelectableImagePrankModelCosts();
    expect(selectableCosts).toHaveLength(IMAGE_PRANK_UI_MODEL_OPTIONS.length);

    for (const model of IMAGE_PRANK_UI_MODEL_OPTIONS) {
      expect(getSelectableImagePrankModelCostMetadata(model).model).toBe(model);
    }
  });
});

describe('image prank generation dimensions', () => {
  it('keeps the default model size when no reference aspect is known', () => {
    expect(imagePrankGenerationDimensionsForAspect(DEFAULT_IMAGE_PRANK_GENERATION_MODEL, null)).toEqual(
      imagePrankGenerationDimensions(DEFAULT_IMAGE_PRANK_GENERATION_MODEL),
    );
  });

  it('preserves a non-9:16 target aspect instead of forcing portrait output', () => {
    const dimensions = imagePrankGenerationDimensionsForAspect(DEFAULT_IMAGE_PRANK_GENERATION_MODEL, 1500 / 2000);

    expect(dimensions.width / dimensions.height).toBeCloseTo(1500 / 2000, 2);
    expect(dimensions.width).not.toBe(1440);
    expect(dimensions.height).not.toBe(2560);
    expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(1440 * 2560 * 1.02);
  });
});
