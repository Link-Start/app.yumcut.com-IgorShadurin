export type PublicCharacter = {
  id: string;
  slug?: string;
  name: string;
  tagline: string;
  bio: string;
  previewImageUrl: string;
  previewVideoUrl?: string | null;
  previewVideoHasAudio?: boolean;
  defaultVoiceId?: string | null;
  defaultVoiceProvider?: string | null;
};
