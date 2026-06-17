import { z } from 'zod';
import { prisma } from '@/server/db';
import { normalizeAppLanguage, parseAppLanguage, type AppLanguageCode } from '@/shared/constants/app-language';

export const patchAccountLanguageSchema = z.object({
  language: z.enum(['en', 'ru']),
});

export async function getAccountLanguage(userId: string): Promise<AppLanguageCode | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLanguage: true },
  });
  if (!user) return null;
  return normalizeAppLanguage(user.preferredLanguage);
}

export async function updateAccountLanguage(
  userId: string,
  language: AppLanguageCode,
): Promise<AppLanguageCode | null> {
  const nextLanguage = parseAppLanguage(language);
  if (!nextLanguage) return null;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { preferredLanguage: nextLanguage },
    select: { preferredLanguage: true },
  });

  return normalizeAppLanguage(updated.preferredLanguage);
}
