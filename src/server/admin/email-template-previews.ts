import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { AdminEmailTemplatePreviewDTO } from '@/shared/types';

const FOLLOW_UP_24H_TEMPLATE = 'follow_up_24h_v1.md';
const FOLLOW_UP_24H_PREVIEW_LANGUAGES = [
  { language: 'en', label: 'English' },
  { language: 'ru', label: 'Russian' },
] as const;

export async function getFollowUp24hTemplatePreviews(): Promise<AdminEmailTemplatePreviewDTO[]> {
  return Promise.all(
    FOLLOW_UP_24H_PREVIEW_LANGUAGES.map(async ({ language, label }) => {
      const relativePath = path.join('email', language, FOLLOW_UP_24H_TEMPLATE);
      const markdown = await readFile(path.join(process.cwd(), relativePath), 'utf8');
      return {
        language,
        label,
        path: relativePath,
        markdown,
      };
    }),
  );
}
