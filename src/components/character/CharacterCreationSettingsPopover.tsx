"use client";

import { Layers, Droplet, Subtitles, Megaphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import { normalizeCharacterCreationSettings } from '@/shared/constants/character-creation-settings';

const COPY: Record<AppLanguageCode, {
  addOverlay: string;
  showWatermark: string;
  addCaptions: string;
  includeCallToAction: string;
}> = {
  en: {
    addOverlay: 'Add overlay',
    showWatermark: 'Show watermark',
    addCaptions: 'Add captions',
    includeCallToAction: 'Include Call to Action',
  },
  ru: {
    addOverlay: 'Добавить оверлей',
    showWatermark: 'Показывать ватермарку',
    addCaptions: 'Добавить субтитры',
    includeCallToAction: 'Добавить призыв к действию',
  },
};

export function CharacterCreationSettingsPopover() {
  const { settings, update } = useSettings();
  const { language } = useAppLanguage();
  const copy = COPY[language];

  if (!settings) return null;
  const characterSettings = normalizeCharacterCreationSettings(settings.characterCreationSettings ?? null);

  const setCharacterSetting = (
    key: 'addOverlay' | 'watermarkEnabled' | 'captionsEnabled' | 'includeCallToAction',
    value: boolean,
  ) => {
    const next = { ...characterSettings, [key]: value };
    void update('characterCreationSettings', next);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate">{copy.addOverlay}</span>
        </div>
        <Switch
          className="cursor-pointer"
          checked={characterSettings.addOverlay}
          onCheckedChange={(value) => setCharacterSetting('addOverlay', !!value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Droplet className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate">{copy.showWatermark}</span>
        </div>
        <Switch
          className="cursor-pointer"
          checked={characterSettings.watermarkEnabled}
          onCheckedChange={(value) => setCharacterSetting('watermarkEnabled', !!value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Subtitles className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate">{copy.addCaptions}</span>
        </div>
        <Switch
          className="cursor-pointer"
          checked={characterSettings.captionsEnabled}
          onCheckedChange={(value) => setCharacterSetting('captionsEnabled', !!value)}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate">{copy.includeCallToAction}</span>
        </div>
        <Switch
          className="cursor-pointer"
          checked={characterSettings.includeCallToAction}
          onCheckedChange={(value) => setCharacterSetting('includeCallToAction', !!value)}
        />
      </div>
    </div>
  );
}
