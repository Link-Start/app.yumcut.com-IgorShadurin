export type ImageGenerationProviderId = 'runware';

export const DEFAULT_IMAGE_GENERATION_WIDTH = 1152;
export const DEFAULT_IMAGE_GENERATION_HEIGHT = 2048;
export const DEFAULT_IMAGE_GENERATION_SIZE_LABEL =
  `${DEFAULT_IMAGE_GENERATION_WIDTH}x${DEFAULT_IMAGE_GENERATION_HEIGHT}`;

export const DEFAULT_IMAGE_PRANK_GENERATION_MODEL = 'bytedance:seedream@4.5';
export const DEFAULT_IMAGE_PRANK_GENERATION_WIDTH = 1440;
export const DEFAULT_IMAGE_PRANK_GENERATION_HEIGHT = 2560;
export const DEFAULT_IMAGE_PRANK_GENERATION_SIZE_LABEL =
  `${DEFAULT_IMAGE_PRANK_GENERATION_WIDTH}x${DEFAULT_IMAGE_PRANK_GENERATION_HEIGHT}`;

export const IMAGE_PRANK_TWO_REFERENCE_MODELS = [
  DEFAULT_IMAGE_PRANK_GENERATION_MODEL,
  'klingai:kling-image@o3',
  'bytedance:5@0',
  'alibaba:wan@2.7-image',
  'bfl:5@1',
  'krea:krea@2-medium',
  'prunaai:2@1',
  'krea:krea@2-turbo',
] as const;

export type ImagePrankGenerationModel = typeof IMAGE_PRANK_TWO_REFERENCE_MODELS[number];

export const IMAGE_PRANK_UI_MODEL_OPTIONS = [
  DEFAULT_IMAGE_PRANK_GENERATION_MODEL,
  'klingai:kling-image@o3',
  'bytedance:5@0',
  'alibaba:wan@2.7-image',
  'prunaai:2@1',
] as const satisfies readonly ImagePrankGenerationModel[];

export type ImagePrankSelectableModel = typeof IMAGE_PRANK_UI_MODEL_OPTIONS[number];

export type ImagePrankSelectableModelOption = {
  id: ImagePrankSelectableModel;
  label: string;
  isDefault: boolean;
};

export const IMAGE_PRANK_SELECTABLE_MODEL_OPTIONS = [
  { id: DEFAULT_IMAGE_PRANK_GENERATION_MODEL, label: 'Default (Seedream)', isDefault: true },
  { id: 'klingai:kling-image@o3', label: 'Kling O3', isDefault: false },
  { id: 'bytedance:5@0', label: 'Bytedance 5', isDefault: false },
  { id: 'alibaba:wan@2.7-image', label: 'Alibaba Wan 2.7', isDefault: false },
  { id: 'prunaai:2@1', label: 'Pruna 2.1', isDefault: false },
] as const satisfies readonly ImagePrankSelectableModelOption[];

export function normalizeSelectableImagePrankGenerationModel(value: string | null | undefined): ImagePrankSelectableModel | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return IMAGE_PRANK_UI_MODEL_OPTIONS.find((model) => model === normalized) ?? null;
}

const IMAGE_PRANK_MODEL_DIMENSIONS: Record<ImagePrankGenerationModel, { width: number; height: number }> = {
  [DEFAULT_IMAGE_PRANK_GENERATION_MODEL]: {
    width: DEFAULT_IMAGE_PRANK_GENERATION_WIDTH,
    height: DEFAULT_IMAGE_PRANK_GENERATION_HEIGHT,
  },
  'klingai:kling-image@o3': { width: 2048, height: 2048 },
  'bytedance:5@0': { width: DEFAULT_IMAGE_GENERATION_WIDTH, height: DEFAULT_IMAGE_GENERATION_HEIGHT },
  'alibaba:wan@2.7-image': { width: DEFAULT_IMAGE_GENERATION_WIDTH, height: DEFAULT_IMAGE_GENERATION_HEIGHT },
  'bfl:5@1': { width: DEFAULT_IMAGE_GENERATION_WIDTH, height: DEFAULT_IMAGE_GENERATION_HEIGHT },
  'krea:krea@2-medium': { width: 928, height: 1152 },
  'prunaai:2@1': { width: 896, height: 1184 },
  'krea:krea@2-turbo': { width: 928, height: 1152 },
};

export function normalizeImagePrankGenerationModel(value: string | null | undefined): ImagePrankGenerationModel | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return IMAGE_PRANK_TWO_REFERENCE_MODELS.find((model) => model === normalized) ?? null;
}

export function imagePrankGenerationDimensions(model: ImagePrankGenerationModel): { width: number; height: number } {
  return IMAGE_PRANK_MODEL_DIMENSIONS[model];
}

export type ImageGenerationModel = {
  id: string;
  label: string;
  provider: ImageGenerationProviderId;
};

export type ImageGenerationProvider = {
  id: ImageGenerationProviderId;
  label: string;
  models: ImageGenerationModel[];
};

export const IMAGE_GENERATION_PROVIDERS: ImageGenerationProvider[] = [
  {
    id: 'runware',
    label: 'Runware',
    models: [
      { id: 'runware:108@1', label: 'Qwen Image (base)', provider: 'runware' },
    ],
  },
] as const;

export function resolveImageProvider(id: string | null | undefined): ImageGenerationProvider | null {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  return IMAGE_GENERATION_PROVIDERS.find((provider) => provider.id === normalized) ?? null;
}
