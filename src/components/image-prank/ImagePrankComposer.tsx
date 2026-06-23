"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus, Images, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { storeProjectDraft } from '@/lib/project-draft';
import { resolveStorageBaseUrl } from '@/components/main/character-modal/storage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { TOKEN_COSTS } from '@/shared/constants/token-costs';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type {
  ImagePrankCatalogItemDTO,
  ImagePrankMode,
  ImagePrankSourceImageRole,
  PendingProjectDraft,
  ProjectDraftSettingsSnapshot,
} from '@/shared/types';

type UploadedSource = {
  role: ImagePrankSourceImageRole;
  path: string;
  url: string;
  label: string;
};

type ImageSlotState = {
  file: File | null;
  previewUrl: string | null;
};

const MAX_STORAGE_IMAGE_DIMENSION = 2000;

const COPY: Record<AppLanguageCode, {
  title: string;
  customTitle: string;
  catalogLabel: string;
  prankImage: string;
  targetImage: string;
  referenceImage: string;
  upload: string;
  replace: string;
  promptLabel: string;
  twoImagePromptPlaceholder: string;
  oneImagePromptPlaceholder: string;
  twoImageDefaultPrompt: string;
  oneImageDefaultPrompt: string;
  twoImageHint: string;
  oneImageHint: string;
  twoImages: string;
  oneImage: string;
  create: string;
  uploading: string;
  back: string;
  missingPrompt: string;
  missingImages: string;
  tokenLoadFailed: string;
}> = {
  en: {
    title: 'Image Prank',
    customTitle: 'Custom mix',
    catalogLabel: 'Catalog image',
    prankImage: 'Prank image',
    targetImage: 'Target image',
    referenceImage: 'Reference image',
    upload: 'Upload',
    replace: 'Replace',
    promptLabel: 'Prompt',
    twoImagePromptPlaceholder: 'Example: place the prank image naturally inside the target photo. You can also say first image and second image.',
    oneImagePromptPlaceholder: 'Example: turn this image into a funny prank scene.',
    twoImageDefaultPrompt: 'Place the prank image on the target image so it fits the lighting, perspective, scale, and natural position.',
    oneImageDefaultPrompt: 'Edit this image into a natural prank scene while preserving the lighting, perspective, and realistic placement.',
    twoImageHint: 'The prank image is the first image. The target image is the second image. Describe how the first should fit into the second.',
    oneImageHint: 'Upload one image and describe the prank edit you want to make to it.',
    twoImages: '2 images',
    oneImage: '1 image',
    create: 'Continue',
    uploading: 'Uploading',
    back: 'Back',
    missingPrompt: 'Enter a prompt',
    missingImages: 'Upload the required images',
    tokenLoadFailed: 'Could not load token balance',
  },
  ru: {
    title: 'Image Prank',
    customTitle: 'Свой микс',
    catalogLabel: 'Картинка из каталога',
    prankImage: 'Prank-картинка',
    targetImage: 'Целевое изображение',
    referenceImage: 'Референс',
    upload: 'Загрузить',
    replace: 'Заменить',
    promptLabel: 'Промпт',
    twoImagePromptPlaceholder: 'Например: естественно поместить prank-картинку на целевое фото. Можно писать первое и второе изображение.',
    oneImagePromptPlaceholder: 'Например: превратить это изображение в смешную prank-сцену.',
    twoImageDefaultPrompt: 'Помести prank-картинку на целевое изображение так, чтобы она подходила по освещению, перспективе, масштабу и естественной позиции.',
    oneImageDefaultPrompt: 'Преврати это изображение в естественную prank-сцену, сохранив освещение, перспективу и реалистичное размещение.',
    twoImageHint: 'Prank-картинка - первое изображение. Целевое изображение - второе. Опишите, как первое должно вписаться во второе.',
    oneImageHint: 'Загрузите одно изображение и опишите prank-правку, которую нужно сделать.',
    twoImages: '2 изображения',
    oneImage: '1 изображение',
    create: 'Продолжить',
    uploading: 'Загрузка',
    back: 'Назад',
    missingPrompt: 'Введите промпт',
    missingImages: 'Загрузите нужные изображения',
    tokenLoadFailed: 'Не удалось загрузить баланс токенов',
  },
};

function pickTitle(item: ImagePrankCatalogItemDTO | null, language: AppLanguageCode) {
  if (!item) return '';
  return language === 'ru' ? item.title.ru || item.title.en : item.title.en || item.title.ru;
}

function defaultSettings(): ProjectDraftSettingsSnapshot {
  return {
    includeDefaultMusic: false,
    addOverlay: false,
    includeCallToAction: false,
    autoApproveScript: true,
    autoApproveAudio: true,
    watermarkEnabled: false,
    captionsEnabled: false,
    targetLanguages: ['en'],
    languageVoicePreferences: {},
    scriptCreationGuidanceEnabled: false,
    scriptCreationGuidance: '',
    scriptAvoidanceGuidanceEnabled: false,
    scriptAvoidanceGuidance: '',
    audioStyleGuidanceEnabled: false,
    audioStyleGuidance: '',
  };
}

function createDraftId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function UploadSlot({
  label,
  state,
  onChange,
  disabled,
}: {
  label: string;
  state: ImageSlotState;
  onChange: (file: File | null) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</Label>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        className="group flex aspect-[9/16] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
      >
        {state.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.previewUrl} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 p-4 text-sm text-gray-600 dark:text-gray-300">
            <UploadCloud className="h-6 w-6 text-blue-500" />
            {label}
          </span>
        )}
      </button>
    </div>
  );
}

async function uploadSource(file: File, role: ImagePrankSourceImageRole, label: string, storageBaseUrl: string): Promise<UploadedSource> {
  const uploadFile = role === 'target' ? await resizeImageForStorage(file) : file;
  const grant = await Api.createCharacterUploadToken();
  if (!grant?.data || !grant.signature) throw new Error('Upload authorization failed');
  if (!grant.mimeTypes.includes(uploadFile.type)) throw new Error('Selected file type is not allowed');
  if (uploadFile.size > grant.maxBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.floor(grant.maxBytes / 1024 / 1024)}MB`);
  }

  const form = new FormData();
  form.set('file', uploadFile);
  form.set('data', grant.data);
  form.set('signature', grant.signature);

  const response = await fetch(`${storageBaseUrl.replace(/\/$/, '')}/api/storage/user-images`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Storage upload failed (${response.status})${text ? `: ${text}` : ''}`);
  }
  const payload = await response.json();
  if (!payload?.path || !payload?.url) throw new Error('Storage response missing image URL');
  return {
    role,
    path: payload.path,
    url: payload.url,
    label,
  };
}

function imageMimeAndName(file: File) {
  if (file.type === 'image/png') return { mimeType: 'image/png', extension: 'png' };
  if (file.type === 'image/webp') return { mimeType: 'image/webp', extension: 'webp' };
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

function fileNameWithExtension(fileName: string, extension: string) {
  const base = fileName.trim().replace(/\.[a-z0-9]+$/i, '') || 'target-image';
  return `${base}.${extension}`;
}

async function decodeImageFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image'));
    };
    image.src = url;
  });
}

async function resizeImageForStorage(file: File): Promise<File> {
  const decoded = await decodeImageFile(file);
  const isHtmlImage = typeof HTMLImageElement !== 'undefined' && decoded instanceof HTMLImageElement;
  const width = isHtmlImage ? decoded.naturalWidth : decoded.width;
  const height = isHtmlImage ? decoded.naturalHeight : decoded.height;
  const maxDimension = Math.max(width, height);
  if (!width || !height || maxDimension <= MAX_STORAGE_IMAGE_DIMENSION) return file;

  const scale = MAX_STORAGE_IMAGE_DIMENSION / maxDimension;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const { mimeType, extension } = imageMimeAndName(file);
  const quality = mimeType === 'image/jpeg' ? 0.94 : mimeType === 'image/webp' ? 0.95 : undefined;
  const fileName = fileNameWithExtension(file.name, extension);

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.drawImage(decoded as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    return new File([blob], fileName, { type: mimeType });
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(decoded as CanvasImageSource, 0, 0, targetWidth, targetHeight);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((output) => resolve(output), mimeType, quality);
  });
  if (!blob) throw new Error('Failed to resize image');
  return new File([blob], fileName, { type: mimeType });
}

export function ImagePrankComposer({ item }: { item?: ImagePrankCatalogItemDTO | null }) {
  const { language } = useAppLanguage();
  const copy = COPY[language];
  const router = useRouter();
  const storageBaseUrl = useMemo(resolveStorageBaseUrl, []);
  const [prompt, setPrompt] = useState(copy.twoImageDefaultPrompt);
  const [oneImageMode, setOneImageMode] = useState(false);
  const [prankFile, setPrankFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokenCost, setTokenCost] = useState(TOKEN_COSTS.actions.imageGeneration);
  const [submitting, setSubmitting] = useState(false);
  const prankPreviewUrl = useObjectUrl(prankFile);
  const targetPreviewUrl = useObjectUrl(targetFile);
  const isCatalogMode = !!item;
  const mode: ImagePrankMode = isCatalogMode
    ? 'catalog'
    : oneImageMode
      ? 'custom-one-image'
      : 'custom-two-image';
  const itemTitle = pickTitle(item ?? null, language);
  const imageHint = oneImageMode && !item ? copy.oneImageHint : copy.twoImageHint;
  const promptPlaceholder = oneImageMode && !item ? copy.oneImagePromptPlaceholder : copy.twoImagePromptPlaceholder;
  const defaultPrompt = oneImageMode && !item ? copy.oneImageDefaultPrompt : copy.twoImageDefaultPrompt;

  useEffect(() => {
    setPrompt((current) => {
      const defaults = Object.values(COPY).flatMap((entry) => [
        entry.twoImageDefaultPrompt,
        entry.oneImageDefaultPrompt,
      ]);
      return current.trim() === '' || defaults.includes(current) ? defaultPrompt : current;
    });
  }, [defaultPrompt]);

  useEffect(() => {
    let cancelled = false;
    Api.getTokenSummary()
      .then((summary) => {
        if (cancelled) return;
        setTokenBalance(summary.balance);
        setTokenCost(summary.actionCosts.imageGeneration ?? TOKEN_COSTS.actions.imageGeneration);
      })
      .catch(() => {
        if (!cancelled) toast.error(copy.tokenLoadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.tokenLoadFailed]);

  const validate = () => {
    if (!prompt.trim()) {
      toast.error(copy.missingPrompt);
      return false;
    }
    if (isCatalogMode && !targetFile) {
      toast.error(copy.missingImages);
      return false;
    }
    if (!isCatalogMode && !oneImageMode && (!prankFile || !targetFile)) {
      toast.error(copy.missingImages);
      return false;
    }
    if (!isCatalogMode && oneImageMode && !targetFile) {
      toast.error(copy.missingImages);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const uploaded: UploadedSource[] = [];
      if (isCatalogMode) {
        uploaded.push(await uploadSource(targetFile!, 'target', copy.targetImage, storageBaseUrl));
      } else if (oneImageMode) {
        uploaded.push(await uploadSource(targetFile!, 'target', copy.referenceImage, storageBaseUrl));
      } else {
        const [prank, target] = await Promise.all([
          uploadSource(prankFile!, 'prank', copy.prankImage, storageBaseUrl),
          uploadSource(targetFile!, 'target', copy.targetImage, storageBaseUrl),
        ]);
        uploaded.push(prank, target);
      }

      const draftId = createDraftId();
      const payload: PendingProjectDraft['payload'] = {
        prompt: prompt.trim(),
        projectExperience: 'image-generation',
        imagePrank: {
          mode,
          ...(item ? { catalogItemId: item.id } : {}),
          sourceImages: uploaded.map((source) => ({
            role: source.role,
            path: source.path,
            url: source.url,
            label: source.label,
          })),
        },
      };
      const previewImageUrl = item?.imageUrl ?? uploaded[0]?.url ?? null;
      const draft: PendingProjectDraft = {
        id: draftId,
        createdAt: new Date().toISOString(),
        text: prompt.trim(),
        useExact: false,
        groupMode: false,
        mode: 'idea',
        durationSeconds: null,
        effectiveDurationSeconds: 0,
        languageCode: 'en',
        languageCodes: ['en'],
        languageVoices: {},
        tokenCost,
        tokenBalance,
        hasEnoughTokens: tokenBalance >= tokenCost,
        outputType: 'image',
        settings: defaultSettings(),
        voiceId: null,
        character: previewImageUrl ? {
          characterTitle: itemTitle || copy.title,
          variationTitle: item ? copy.catalogLabel : copy.customTitle,
          source: 'global',
          imageUrl: previewImageUrl,
        } : null,
        template: null,
        payload,
      };
      storeProjectDraft(draft);
      router.push(`/create/confirm/${draftId}`);
    } catch (err) {
      console.error('Image prank draft failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to prepare Image Prank');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-14 pt-2 sm:px-4 lg:px-0">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </button>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{copy.title}</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <div className="grid grid-cols-2 gap-3 self-start">
          {item ? (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">{copy.catalogLabel}</Label>
              <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={itemTitle} className="h-full w-full object-contain" />
              </div>
            </div>
          ) : oneImageMode ? null : (
            <UploadSlot
              label={copy.prankImage}
              state={{ file: prankFile, previewUrl: prankPreviewUrl }}
              onChange={setPrankFile}
              disabled={submitting}
            />
          )}
          <UploadSlot
            label={oneImageMode && !item ? copy.referenceImage : copy.targetImage}
            state={{ file: targetFile, previewUrl: targetPreviewUrl }}
            onChange={setTargetFile}
            disabled={submitting}
          />
          <p className="col-span-2 text-sm leading-5 text-gray-600 dark:text-gray-400">
            {imageHint}
          </p>
        </div>

        <div className="flex h-full flex-col gap-4">
          <div className="flex min-h-[360px] flex-1 flex-col space-y-2">
            <Label htmlFor="image-prank-prompt" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {copy.promptLabel}
            </Label>
            <Textarea
              id="image-prank-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={promptPlaceholder}
              className="min-h-[320px] flex-1 resize-none"
              disabled={submitting}
            />
          </div>

          {!item ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
              {[
                { value: false, label: copy.twoImages, Icon: Images },
                { value: true, label: copy.oneImage, Icon: ImagePlus },
              ].map((option) => {
                const active = oneImageMode === option.value;
                const OptionIcon = option.Icon;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => {
                      setOneImageMode(option.value);
                      if (option.value) setPrankFile(null);
                    }}
                    className={cn(
                      'inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-sm font-medium leading-none transition-[background-color,color,box-shadow]',
                      active
                        ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
                        : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
                    )}
                    aria-pressed={active}
                    disabled={submitting}
                  >
                    <OptionIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="inline-flex items-center whitespace-nowrap leading-none">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <Button type="button" className="w-full cursor-pointer" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {submitting ? copy.uploading : copy.create}
          </Button>
        </div>
      </div>
    </div>
  );
}
