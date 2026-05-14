import { withApiError } from '@/server/errors';
import { ok } from '@/server/http';
import { listPublicVoices } from '@/server/voices';
import { getAdminVoiceProviderSettings } from '@/server/admin/voice-providers';
import { buildVoiceProviderSet } from '@/shared/constants/voice-providers';
import { VOICE_PROVIDER_AVAILABILITY_RULES } from '@/shared/voices/provider-availability-policy';

export const GET = withApiError(async function GET() {
  const settings = await getAdminVoiceProviderSettings();
  const allowedProviders = buildVoiceProviderSet(settings.enabledProviders);
  const voices = await listPublicVoices({ allowedProviders });
  return ok({
    voices: voices.map((voice) => ({
      id: voice.id,
      title: voice.title,
      description: voice.description ?? null,
      externalId: voice.externalId,
      languages: voice.languages ?? null,
      speed: voice.speed ?? null,
      gender: voice.gender ?? null,
      previewPath: voice.previewPath ?? null,
      voiceProvider: voice.voiceProvider ?? null,
      weight: typeof voice.weight === 'number' ? voice.weight : 0,
    })),
    providerAvailabilityRules: VOICE_PROVIDER_AVAILABILITY_RULES,
  });
}, 'Failed to load voices');
