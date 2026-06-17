import { promises as fs } from 'fs';
import path from 'path';

export type SupportedVoiceCloneProvider = 'minimax' | 'elevenlabs' | 'inworld';

export type VoiceCloneFallbackResult = {
  path: string;
  languageName: string;
  provider: 'runpod-clone';
};

const LANGUAGE_DIRS: Record<string, { dir: string; name: string }> = {
  en: { dir: 'english', name: 'English' },
  ru: { dir: 'russian', name: 'Russian' },
  es: { dir: 'spanish', name: 'Spanish' },
  fr: { dir: 'french', name: 'French' },
  de: { dir: 'german', name: 'German' },
  pt: { dir: 'portuguese', name: 'Portuguese' },
  it: { dir: 'italian', name: 'Italian' },
};

export async function resolveVoiceCloneFallback(params: {
  fallbackDir: string;
  provider: SupportedVoiceCloneProvider;
  voiceId: string;
  languageCode: string;
}): Promise<VoiceCloneFallbackResult | null> {
  const language = languageInfoForCode(params.languageCode);
  const voiceId = params.voiceId.trim();
  if (!language || !voiceId) return null;

  const candidates = buildVoiceCloneCandidates({
    fallbackDir: params.fallbackDir,
    provider: params.provider,
    voiceId,
    languageDir: language.dir,
  });

  for (const candidate of candidates) {
    if (await isReadableFile(candidate)) {
      return {
        path: candidate,
        languageName: language.name,
        provider: 'runpod-clone',
      };
    }
  }
  return null;
}

export function buildVoiceCloneCandidates(params: {
  fallbackDir: string;
  provider: SupportedVoiceCloneProvider;
  voiceId: string;
  languageDir: string;
}): string[] {
  const root = params.fallbackDir;
  if (params.provider === 'minimax') {
    return [path.join(root, 'minimax', params.languageDir, `${params.voiceId}.mp3`)];
  }
  const slug = slugifyVoiceId(params.voiceId);
  if (params.provider === 'inworld') {
    return [path.join(root, 'inworld', params.languageDir, `${slug}.mp3`)];
  }
  return [
    path.join(root, 'elevenlabs', params.languageDir, `${slug}.mp3`),
    path.join(root, 'elevenlabs', `${slug}.mp3`),
    path.join(root, `${slug}.mp3`),
    path.join(root, `${params.voiceId}.mp3`),
  ];
}

export function languageInfoForCode(code: string): { dir: string; name: string } | null {
  const normalized = code.trim().toLowerCase().replace(/_/g, '-').split('-')[0] || '';
  return LANGUAGE_DIRS[normalized] ?? null;
}

export function slugifyVoiceId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'voice';
}

async function isReadableFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
