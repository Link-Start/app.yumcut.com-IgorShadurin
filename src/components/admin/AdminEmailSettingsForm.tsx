'use client';

import { useState } from 'react';
import { ChevronDown, MailCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Api } from '@/lib/api-client';
import type { AdminEmailSettingsDTO, AdminEmailTemplatePreviewDTO } from '@/shared/types';

interface Props {
  initial: AdminEmailSettingsDTO;
  templates: AdminEmailTemplatePreviewDTO[];
}

export function AdminEmailSettingsForm({ initial, templates }: Props) {
  const [settings, setSettings] = useState<AdminEmailSettingsDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

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
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-4">
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
      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={templatesOpen}
          onClick={() => setTemplatesOpen((open) => !open)}
          className="h-auto gap-2 px-0 py-1 text-sm font-medium text-gray-700 hover:bg-transparent dark:text-gray-300 dark:hover:bg-transparent cursor-pointer"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${templatesOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          {templatesOpen ? 'Hide templates' : 'Show templates'}
        </Button>
        {templatesOpen ? (
          <Tabs defaultValue={templates[0]?.language ?? 'en'} className="mt-3">
            <TabsList>
              {templates.map((template) => (
                <TabsTrigger key={template.language} value={template.language}>
                  {template.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {templates.map((template) => (
              <TabsContent key={template.language} value={template.language}>
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                    {template.path}
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-white p-3 text-xs leading-5 text-gray-800 dark:bg-gray-950 dark:text-gray-200">{template.markdown}</pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : null}
      </div>
    </div>
  );
}
