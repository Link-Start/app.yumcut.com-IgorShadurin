import {
  IMAGE_PRANK_TWO_REFERENCE_MODELS,
  IMAGE_PRANK_UI_MODEL_OPTIONS,
  type ImagePrankGenerationModel,
  type ImagePrankSelectableModel,
} from '@/shared/constants/image-generation';

export type ImageGenerationCostMetadata = {
  model: ImagePrankGenerationModel;
  estimatedCostUsd: number;
  currency: 'USD';
  unit: 'image_generation';
  source: 'runware_response_cost';
  verifiedAt: string;
  evidence?: string;
  notes?: string;
};

const COST_SOURCE = {
  currency: 'USD',
  unit: 'image_generation',
  source: 'runware_response_cost',
  verifiedAt: '2026-06-26',
  evidence: '/Users/test/Downloads/image-mix-model-test-final-2026-06-26T16-53-10/summary.json',
} as const;

export const IMAGE_PRANK_MODEL_COST_METADATA = {
  'bytedance:seedream@4.5': {
    ...COST_SOURCE,
    model: 'bytedance:seedream@4.5',
    estimatedCostUsd: 0.04,
  },
  'klingai:kling-image@o3': {
    ...COST_SOURCE,
    model: 'klingai:kling-image@o3',
    estimatedCostUsd: 0.028,
  },
  'bytedance:5@0': {
    ...COST_SOURCE,
    model: 'bytedance:5@0',
    estimatedCostUsd: 0.03,
    notes: 'Runware Seedream 4.0 model alias used by the image mix tool.',
  },
  'alibaba:wan@2.7-image': {
    ...COST_SOURCE,
    model: 'alibaba:wan@2.7-image',
    estimatedCostUsd: 0.03,
  },
  'bfl:5@1': {
    ...COST_SOURCE,
    model: 'bfl:5@1',
    estimatedCostUsd: 0.09,
  },
  'krea:krea@2-medium': {
    ...COST_SOURCE,
    model: 'krea:krea@2-medium',
    estimatedCostUsd: 0.035,
  },
  'prunaai:2@1': {
    ...COST_SOURCE,
    model: 'prunaai:2@1',
    estimatedCostUsd: 0.0088,
  },
  'krea:krea@2-turbo': {
    ...COST_SOURCE,
    model: 'krea:krea@2-turbo',
    estimatedCostUsd: 0.0175,
  },
} as const satisfies Record<ImagePrankGenerationModel, ImageGenerationCostMetadata>;

export function getImagePrankModelCostMetadata(
  model: ImagePrankGenerationModel,
): ImageGenerationCostMetadata {
  return IMAGE_PRANK_MODEL_COST_METADATA[model];
}

export function getSelectableImagePrankModelCostMetadata(
  model: ImagePrankSelectableModel,
): ImageGenerationCostMetadata {
  return IMAGE_PRANK_MODEL_COST_METADATA[model];
}

export function estimateImagePrankProviderCostUsd(model: ImagePrankGenerationModel): number {
  return getImagePrankModelCostMetadata(model).estimatedCostUsd;
}

export function listInternalImagePrankModelCosts(): ImageGenerationCostMetadata[] {
  return IMAGE_PRANK_TWO_REFERENCE_MODELS.map((model) => IMAGE_PRANK_MODEL_COST_METADATA[model]);
}

export function listInternalSelectableImagePrankModelCosts(): ImageGenerationCostMetadata[] {
  return IMAGE_PRANK_UI_MODEL_OPTIONS.map((model) => IMAGE_PRANK_MODEL_COST_METADATA[model]);
}
