import { describe, expect, it } from 'vitest';
import {
  getExcludedVoiceProviders,
  getExcludedVoiceProvidersFromRules,
  isVoiceProviderExcluded,
  isVoiceProviderExcludedFromRules,
} from '@/shared/voices/provider-availability-policy';

describe('voice provider availability policy', () => {
  it('excludes Inworld for character idea mode in Russian', () => {
    const excluded = getExcludedVoiceProviders({
      projectExperience: 'character',
      mode: 'idea',
      languageCode: 'ru',
    });
    expect(excluded.has('inworld')).toBe(true);
    expect(isVoiceProviderExcluded('inworld', {
      projectExperience: 'character',
      mode: 'idea',
      languageCode: 'ru',
    })).toBe(true);
  });

  it('does not exclude Inworld for character script mode in Russian', () => {
    const excluded = getExcludedVoiceProviders({
      projectExperience: 'character',
      mode: 'script',
      languageCode: 'ru',
    });
    expect(excluded.has('inworld')).toBe(false);
  });

  it('does not exclude Inworld for story idea mode in Russian', () => {
    const excluded = getExcludedVoiceProviders({
      projectExperience: 'story',
      mode: 'idea',
      languageCode: 'ru',
    });
    expect(excluded.has('inworld')).toBe(false);
  });

  it('evaluates exclusions from serialized rules payload', () => {
    const excluded = getExcludedVoiceProvidersFromRules([
      {
        projectExperiences: ['story'],
        modes: ['script'],
        languages: ['en'],
        providers: ['elevenlabs'],
      },
    ], {
      projectExperience: 'story',
      mode: 'script',
      languageCode: 'en',
    });
    expect(excluded.has('elevenlabs')).toBe(true);
    expect(isVoiceProviderExcludedFromRules('elevenlabs', [
      {
        projectExperiences: ['story'],
        modes: ['script'],
        languages: ['en'],
        providers: ['elevenlabs'],
      },
    ], {
      projectExperience: 'story',
      mode: 'script',
      languageCode: 'en',
    })).toBe(true);
  });
});
