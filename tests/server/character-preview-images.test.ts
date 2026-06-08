import { describe, expect, it } from 'vitest';
import {
  buildCharacterPreviewConversionUrl,
  resolveCatalogPreviewImageUrl,
} from '@/server/character-preview-images';

describe('character preview image helpers', () => {
  it('uses a ready stored catalog preview variant when present', () => {
    expect(resolveCatalogPreviewImageUrl([
      {
        id: 'var-1',
        imagePath: 'characters/source.webp',
        imageVariants: [{
          kind: 'catalog-preview',
          height: 896,
          status: 'ready',
          path: 'characters/variants/catalog-preview/h896/generated.webp',
          url: null,
        }],
      },
    ])).toMatch(/\/api\/media\/characters\/variants\/catalog-preview\/h896\/generated\.webp$/);
  });

  it('returns the conversion URL when a catalog preview variant is missing', () => {
    expect(resolveCatalogPreviewImageUrl([
      {
        id: 'var-1',
        imagePath: 'characters/source.webp',
        imageVariants: [],
      },
    ])).toBe(buildCharacterPreviewConversionUrl('var-1'));
  });
});
