import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildVoiceCloneCandidates,
  resolveVoiceCloneFallback,
  slugifyVoiceId,
} from '../../scripts/daemon/helpers/voice-clone-fallback';

describe('voice clone fallback resolver', () => {
  let tmpRoot: string | null = null;

  afterEach(async () => {
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
    }
  });

  it('finds MiniMax clone files by language folder and voice id', async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'daemon-voice-clone-'));
    const clonePath = path.join(tmpRoot, 'minimax', 'english', 'English_CalmWoman.mp3');
    await mkdir(path.dirname(clonePath), { recursive: true });
    await writeFile(clonePath, 'fake audio');

    const result = await resolveVoiceCloneFallback({
      fallbackDir: tmpRoot,
      provider: 'minimax',
      voiceId: 'English_CalmWoman',
      languageCode: 'en',
    });

    expect(result).toEqual({
      path: clonePath,
      languageName: 'English',
      provider: 'runpod-clone',
    });
  });

  it('uses the same ASCII slug as voice previews for Inworld files', () => {
    expect(slugifyVoiceId('Hélène')).toBe('h-l-ne');
    expect(slugifyVoiceId('Maitê')).toBe('mait');
    expect(buildVoiceCloneCandidates({
      fallbackDir: '/voices-clone',
      provider: 'inworld',
      voiceId: 'Hélène',
      languageDir: 'french',
    })).toEqual(['/voices-clone/inworld/french/h-l-ne.mp3']);
  });

  it('returns null when no cloned voice file exists', async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'daemon-voice-clone-missing-'));
    const result = await resolveVoiceCloneFallback({
      fallbackDir: tmpRoot,
      provider: 'minimax',
      voiceId: 'MissingVoice',
      languageCode: 'en',
    });

    expect(result).toBeNull();
  });
});
