import { ADMIN_SETTING_KEYS, getAdminSettingValue, setAdminSettingValue } from '@/server/admin/admin-settings';
import { prisma } from '@/server/db';

export type AdminEmailSettings = {
  registrationEmailsEnabled: boolean;
};

const DEFAULT_SETTINGS: AdminEmailSettings = {
  registrationEmailsEnabled: true,
};

function normalizeAdminEmailSettings(raw: unknown): AdminEmailSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const candidate = raw as Partial<AdminEmailSettings>;
  return {
    registrationEmailsEnabled: typeof candidate.registrationEmailsEnabled === 'boolean'
      ? candidate.registrationEmailsEnabled
      : DEFAULT_SETTINGS.registrationEmailsEnabled,
  };
}

export async function getAdminEmailSettings(
  tx: Parameters<typeof getAdminSettingValue>[1] = prisma
): Promise<AdminEmailSettings> {
  const raw = await getAdminSettingValue<AdminEmailSettings>(ADMIN_SETTING_KEYS.emails, tx);
  const normalized = normalizeAdminEmailSettings(raw);
  if (!raw || typeof raw !== 'object' || normalized.registrationEmailsEnabled !== raw.registrationEmailsEnabled) {
    await setAdminSettingValue(ADMIN_SETTING_KEYS.emails, normalized, tx);
  }
  return normalized;
}

export async function updateAdminEmailSettings(update: Partial<AdminEmailSettings>): Promise<AdminEmailSettings> {
  const current = await getAdminEmailSettings();
  const next: AdminEmailSettings = {
    registrationEmailsEnabled: typeof update.registrationEmailsEnabled === 'boolean'
      ? update.registrationEmailsEnabled
      : current.registrationEmailsEnabled,
  };
  await setAdminSettingValue(ADMIN_SETTING_KEYS.emails, next);
  return next;
}

export async function shouldSendRegistrationEmails(): Promise<boolean> {
  const settings = await getAdminEmailSettings();
  return settings.registrationEmailsEnabled;
}
