import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveLocalPublicCharacterAssetPath } from '../../scripts/characters/migrate-assets-to-storage';

describe('character asset migration path resolver', () => {
  it('maps legacy public character URLs to local public files', () => {
    const root = path.resolve('/repo/public/characters');
    expect(resolveLocalPublicCharacterAssetPath('/characters/brainrot/matteo/original/prepared.webp', root))
      .toBe(path.join(root, 'brainrot', 'matteo', 'original', 'prepared.webp'));
    expect(resolveLocalPublicCharacterAssetPath('public/characters/brainrot/matteo/preview/preview.mp4', root))
      .toBe(path.join(root, 'brainrot', 'matteo', 'preview', 'preview.mp4'));
  });

  it('ignores storage URLs and traversal attempts', () => {
    const root = path.resolve('/repo/public/characters');
    expect(resolveLocalPublicCharacterAssetPath('/api/media/characters/catalog/prepared.webp', root)).toBeNull();
    expect(resolveLocalPublicCharacterAssetPath('https://storage.test/api/media/characters/catalog/prepared.webp', root)).toBeNull();
    expect(resolveLocalPublicCharacterAssetPath('/characters/../secret.txt', root)).toBeNull();
  });
});
