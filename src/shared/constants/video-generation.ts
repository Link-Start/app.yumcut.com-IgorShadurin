export const DEFAULT_CHARACTER_LIPSYNC_PROMPT =
  'Keep the character facing camera with natural lip movement, subtle facial expression, and stable framing.';

export function defaultCharacterVideoGeneration() {
  return {
    mode: 'lipsync_runware' as const,
    lipsyncPrompt: DEFAULT_CHARACTER_LIPSYNC_PROMPT,
  };
}
