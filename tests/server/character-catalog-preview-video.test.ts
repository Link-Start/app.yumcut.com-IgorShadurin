import { describe, expect, it } from 'vitest';

import { normalizePreviewVideoUrl, resolveCatalogPreviewVideo } from '@/server/character-catalog';

const storageBase = (process.env.NEXT_PUBLIC_STORAGE_BASE_URL || process.env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '');
const mediaUrl = (path: string) => `${storageBase || ''}/api/media/${path}`;

describe('character catalog preview video helpers', () => {
  it('normalizes stored character video paths to storage media URLs', () => {
    expect(normalizePreviewVideoUrl('characters/brainrot/arcadopus/preview/preview.mp4'))
      .toBe(mediaUrl('characters/brainrot/arcadopus/preview/preview.mp4'));
    expect(normalizePreviewVideoUrl('public/characters/brainrot/arcadopus/preview/preview.mp4'))
      .toBe(mediaUrl('characters/brainrot/arcadopus/preview/preview.mp4'));
  });

  it('uses uploaded database video before static catalog overrides', () => {
    expect(resolveCatalogPreviewVideo({
      dbUrl: 'characters/brainrot/matteo/preview/preview.mp4',
      dbHasAudio: false,
      override: {
        previewVideoUrl: mediaUrl('characters/brainrot/matteo/static-preview.mp4'),
        previewVideoHasAudio: true,
      },
    })).toEqual({
      previewVideoUrl: mediaUrl('characters/brainrot/matteo/preview/preview.mp4'),
      previewVideoHasAudio: false,
    });
  });

  it('falls back to static catalog overrides when no uploaded video exists', () => {
    expect(resolveCatalogPreviewVideo({
      dbUrl: null,
      dbHasAudio: true,
      override: {
        previewVideoUrl: mediaUrl('characters/brainrot/matteo/static-preview.mp4'),
        previewVideoHasAudio: false,
      },
    })).toEqual({
      previewVideoUrl: mediaUrl('characters/brainrot/matteo/static-preview.mp4'),
      previewVideoHasAudio: false,
    });
  });
});
