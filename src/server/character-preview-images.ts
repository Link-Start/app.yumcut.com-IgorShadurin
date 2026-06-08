import { normalizeMediaUrl } from '@/server/storage';

export const CHARACTER_CATALOG_PREVIEW_IMAGE_HEIGHT = 896;
export const CHARACTER_CATALOG_PREVIEW_IMAGE_KIND = 'catalog-preview';
export const CHARACTER_CATALOG_PREVIEW_ALLOWED_HEIGHTS = [CHARACTER_CATALOG_PREVIEW_IMAGE_HEIGHT] as const;

export type CharacterPreviewVariantRecord = {
  kind: string;
  height: number;
  status: string;
  path: string | null;
  url: string | null;
};

export type CharacterPreviewVariationRecord = {
  id: string;
  imagePath: string | null;
  imageVariants?: CharacterPreviewVariantRecord[];
};

export function isAllowedCharacterPreviewHeight(height: number): height is typeof CHARACTER_CATALOG_PREVIEW_ALLOWED_HEIGHTS[number] {
  return CHARACTER_CATALOG_PREVIEW_ALLOWED_HEIGHTS.includes(height as any);
}

export function buildCharacterPreviewConversionUrl(variationId: string, height = CHARACTER_CATALOG_PREVIEW_IMAGE_HEIGHT) {
  return `/api/characters/variations/${encodeURIComponent(variationId)}/preview-image?h=${height}`;
}

export function resolveCatalogPreviewImageUrl(variations: CharacterPreviewVariationRecord[]): string {
  const primary = variations.find((entry) => !!entry.imagePath);
  if (!primary?.imagePath) return '';

  const variant = primary.imageVariants?.find((entry) => (
    entry.kind === CHARACTER_CATALOG_PREVIEW_IMAGE_KIND &&
    entry.height === CHARACTER_CATALOG_PREVIEW_IMAGE_HEIGHT &&
    entry.status === 'ready' &&
    (!!entry.path || !!entry.url)
  ));

  if (variant) {
    return normalizeMediaUrl(variant.path ?? variant.url) ?? variant.url ?? '';
  }

  return buildCharacterPreviewConversionUrl(primary.id);
}
