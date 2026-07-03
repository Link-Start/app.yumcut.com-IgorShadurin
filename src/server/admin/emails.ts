import { ADMIN_SETTING_KEYS, getAdminSettingValue, setAdminSettingValue } from '@/server/admin/admin-settings';
import { prisma } from '@/server/db';

export type AdminEmailSettings = {
  followUp24hEnabled: boolean;
};

export type AdminEmailSettingsUpdate = Partial<AdminEmailSettings> & {
  registrationEmailsEnabled?: boolean;
};

type RawAdminEmailSettings = Partial<AdminEmailSettings> & {
  registrationEmailsEnabled?: unknown;
};

const DEFAULT_SETTINGS: AdminEmailSettings = {
  followUp24hEnabled: true,
};

function normalizeAdminEmailSettings(raw: unknown): AdminEmailSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const candidate = raw as RawAdminEmailSettings;
  const legacyFollowUp24hEnabled = typeof candidate.registrationEmailsEnabled === 'boolean'
    ? candidate.registrationEmailsEnabled
    : DEFAULT_SETTINGS.followUp24hEnabled;

  return {
    followUp24hEnabled: typeof candidate.followUp24hEnabled === 'boolean'
      ? candidate.followUp24hEnabled
      : legacyFollowUp24hEnabled,
  };
}

export async function getAdminEmailSettings(
  tx: Parameters<typeof getAdminSettingValue>[1] = prisma
): Promise<AdminEmailSettings> {
  const raw = await getAdminSettingValue<AdminEmailSettings>(ADMIN_SETTING_KEYS.emails, tx);
  const normalized = normalizeAdminEmailSettings(raw);
  const rawCandidate = raw as RawAdminEmailSettings | null;
  if (
    !rawCandidate
    || typeof rawCandidate !== 'object'
    || normalized.followUp24hEnabled !== rawCandidate.followUp24hEnabled
    || 'registrationEmailsEnabled' in rawCandidate
  ) {
    await setAdminSettingValue(ADMIN_SETTING_KEYS.emails, normalized, tx);
  }
  return normalized;
}

export async function updateAdminEmailSettings(update: AdminEmailSettingsUpdate): Promise<AdminEmailSettings> {
  const current = await getAdminEmailSettings();
  const followUp24hEnabled = typeof update.followUp24hEnabled === 'boolean'
    ? update.followUp24hEnabled
    : typeof update.registrationEmailsEnabled === 'boolean'
      ? update.registrationEmailsEnabled
      : current.followUp24hEnabled;
  const next: AdminEmailSettings = {
    followUp24hEnabled,
  };
  await setAdminSettingValue(ADMIN_SETTING_KEYS.emails, next);
  return next;
}

export async function shouldQueueFollowUp24hEmail(): Promise<boolean> {
  const settings = await getAdminEmailSettings();
  return settings.followUp24hEnabled;
}
