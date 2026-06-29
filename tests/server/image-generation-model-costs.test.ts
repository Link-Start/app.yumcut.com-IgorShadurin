import { describe, expect, it } from 'vitest';
import {
  IMAGE_PRANK_TWO_REFERENCE_MODELS,
  IMAGE_PRANK_UI_MODEL_OPTIONS,
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
