'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Api } from '@/lib/api-client';
import type { AdminEmailSettingsDTO } from '@/shared/types';

interface Props {
  initial: AdminEmailSettingsDTO;
}

export function AdminEmailSettingsForm({ initial }: Props) {
  const [settings, setSettings] = useState<AdminEmailSettingsDTO>(initial);
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    if (saving) return;
    const previous = settings.followUp24hEnabled;
    const next = !previous;
    setSettings((prev) => ({ ...prev, followUp24hEnabled: next }));
    setSaving(true);
    try {
      const updated = await Api.updateAdminEmailSettings({ followUp24hEnabled: next });
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update admin email settings', err);
      setSettings((prev) => ({ ...prev, followUp24hEnabled: previous }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex min-w-0 gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
        <div className="space-y-1">
          <Label className="text-base font-medium text-gray-900 dark:text-gray-100">
            24-hour follow-up email
          </Label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Controls only follow_up_24h_v1. Scheduled emails already queued are not affected.
          </p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {settings.followUp24hEnabled
              ? 'Enabled: queue follow_up_24h_v1 after 24 hours.'
              : 'Disabled: skip follow_up_24h_v1.'}
          </p>
        </div>
      </div>
      <Switch
        checked={settings.followUp24hEnabled}
        onCheckedChange={handleToggle}
        disabled={saving}
        aria-label="24-hour follow-up email"
        className={saving ? undefined : 'cursor-pointer'}
      />
    </div>
  );
}
