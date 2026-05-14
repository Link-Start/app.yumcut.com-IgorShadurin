import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminVoiceProviderSettingsMock = vi.hoisted(() => vi.fn());
const listPublicVoicesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/admin/voice-providers', () => ({
  getAdminVoiceProviderSettings: getAdminVoiceProviderSettingsMock,
}));

vi.mock('@/server/voices', () => ({
  listPublicVoices: listPublicVoicesMock,
}));

const route = await import('@/app/api/voices/route');

describe('GET /api/voices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminVoiceProviderSettingsMock.mockResolvedValue({ enabledProviders: ['inworld', 'minimax', 'elevenlabs'] });
    listPublicVoicesMock.mockResolvedValue([
      {
        id: 'voice-1',
        title: 'Voice 1',
        description: 'desc',
        externalId: 'external-1',
        languages: ['en', 'ru'],
        speed: 'fast',
        gender: 'male',
        previewPath: '/api/media/audio/voice-1.mp3',
        voiceProvider: 'inworld',
        weight: 50,
      },
    ]);
  });

  it('returns voices and serialized provider availability rules', async () => {
    const res = await route.GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(listPublicVoicesMock).toHaveBeenCalledTimes(1);
    expect(body.voices).toHaveLength(1);
    expect(body.providerAvailabilityRules).toEqual([
      {
        projectExperiences: ['character'],
        modes: ['idea'],
        languages: ['ru'],
        providers: ['inworld'],
      },
    ]);
  });
});
