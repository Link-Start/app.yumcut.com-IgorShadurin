"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, Download, FileText, ImageIcon, Loader2, Maximize2, MoreVertical, Repeat2, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProjectStatus } from '@/shared/constants/status';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { ProjectDetailDTO } from '@/shared/types';

type Props = {
  project: ProjectDetailDTO;
  projectId: string;
};

type DownloadFormat = 'original' | 'png' | 'jpg' | 'webp';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const COPY: Record<AppLanguageCode, {
  projectActions: string;
  delete: string;
  deleteProjectTitle: string;
  deleteProjectDescription: string;
  deleteProjectWarning: string;
  cancel: string;
  generatedImage: string;
  imagePrank: string;
  generatingImage: string;
  generationFailed: string;
  generationFailedAdminMessage: string;
  generationFailedRefund: (tokens: number) => string;
  generationFailedNoRefund: string;
  imageReady: string;
  progressWaiting: string;
  progressCountdown: (time: string) => string;
  download: string;
  downloadOriginal: string;
  downloadPng: string;
  downloadJpg: string;
  downloadWebp: string;
  downloadFailed: string;
  downloadFailedDescription: string;
  prompt: string;
  copy: string;
  copied: string;
  reuse: string;
  sourceImage: string;
  referenceImages: string;
  zoomImage: string;
  catalogCharacter: string;
  noSourceImage: string;
  source: string;
  unknown: string;
}> = {
  en: {
    projectActions: 'Project actions',
    delete: 'Delete',
    deleteProjectTitle: 'Delete project?',
    deleteProjectDescription: 'This will remove the project from your list. You can’t undo this action.',
    deleteProjectWarning: 'Tokens spent on this image generation will not be refunded.',
    cancel: 'Cancel',
    generatedImage: 'Generated image',
    imagePrank: 'Image Prank',
    generatingImage: 'Generating image',
    generationFailed: 'Image generation failed',
    generationFailedAdminMessage: 'Admin will review this project and handle the issue.',
    generationFailedRefund: (tokens) => `${tokens.toLocaleString()} ${tokens === 1 ? 'token was' : 'tokens were'} returned to your balance.`,
    generationFailedNoRefund: 'No tokens were charged for this failed generation.',
    imageReady: 'Image ready',
    progressWaiting: 'Still working. The result will appear here automatically.',
    progressCountdown: (time) => `Time left: ${time}`,
    download: 'Download',
    downloadOriginal: 'Original',
    downloadPng: 'PNG',
    downloadJpg: 'JPG',
    downloadWebp: 'WebP',
    downloadFailed: 'Download failed',
    downloadFailedDescription: 'Could not prepare the image download. Please try again.',
    prompt: 'Prompt',
    copy: 'Copy',
    copied: 'Copied',
    reuse: 'Reuse',
    sourceImage: 'Source image',
    referenceImages: 'Reference images',
    zoomImage: 'Open image preview',
    catalogCharacter: 'Catalog character',
    noSourceImage: 'No source image was attached.',
    source: 'Source',
    unknown: 'Unknown',
  },
  ru: {
    projectActions: 'Действия проекта',
    delete: 'Удалить',
    deleteProjectTitle: 'Удалить проект?',
    deleteProjectDescription: 'Проект будет удалён из списка. Это действие нельзя отменить.',
    deleteProjectWarning: 'Токены, потраченные на генерацию изображения, не возвращаются.',
    cancel: 'Отмена',
    generatedImage: 'Сгенерированное изображение',
    imagePrank: 'Image Prank',
    generatingImage: 'Генерация изображения',
    generationFailed: 'Генерация изображения завершилась ошибкой',
    generationFailedAdminMessage: 'Администратор проверит проект и решит проблему.',
    generationFailedRefund: (tokens) => `${tokens.toLocaleString()} ${tokens === 1 ? 'токен был возвращён' : 'токенов было возвращено'} на ваш баланс.`,
    generationFailedNoRefund: 'За эту неудачную генерацию токены не списаны.',
    imageReady: 'Изображение готово',
    progressWaiting: 'Продолжаем обработку. Результат появится здесь автоматически.',
    progressCountdown: (time) => `Осталось: ${time}`,
    download: 'Скачать',
    downloadOriginal: 'Оригинал',
    downloadPng: 'PNG',
    downloadJpg: 'JPG',
    downloadWebp: 'WebP',
    downloadFailed: 'Ошибка скачивания',
    downloadFailedDescription: 'Не удалось подготовить изображение. Попробуйте ещё раз.',
    prompt: 'Промпт',
    copy: 'Копировать',
    copied: 'Скопировано',
    reuse: 'Повторить',
    sourceImage: 'Исходное изображение',
    referenceImages: 'Референсные изображения',
    zoomImage: 'Открыть предпросмотр изображения',
    catalogCharacter: 'Персонаж из каталога',
    noSourceImage: 'Исходное изображение не было прикреплено.',
    source: 'Источник',
    unknown: 'Неизвестно',
  },
};

type ZoomImage = {
  url: string;
  label: string;
};

function getProgressPercent(project: ProjectDetailDTO, nowMs: number) {
  if (project.status === ProjectStatus.Done) return 100;
  if (project.status === ProjectStatus.Error || project.status === ProjectStatus.Cancelled) return 100;
  const startedMs = getGenerationStartedMs(project, nowMs);
  const elapsed = Math.max(0, nowMs - startedMs);
  return Math.min(95, Math.max(5, Math.round((elapsed / FIVE_MINUTES_MS) * 95)));
}

function getGenerationStartedMs(project: ProjectDetailDTO, nowMs: number) {
  const startedAt = project.imageGeneration?.startedAt || project.createdAt;
  const parsed = Date.parse(startedAt);
  return Number.isFinite(parsed) ? parsed : nowMs;
}

function getRemainingGenerationMs(project: ProjectDetailDTO, nowMs: number) {
  const elapsed = Math.max(0, nowMs - getGenerationStartedMs(project, nowMs));
  return Math.max(0, FIVE_MINUTES_MS - elapsed);
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function sanitizeFilename(input: string | null | undefined) {
  const value = (input || 'image-prank')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return (value || 'image-prank').slice(0, 96).replace(/^-|-$/g, '') || 'image-prank';
}

function buildDownloadBaseFilename(input: string | null | undefined, projectId: string) {
  const shortProjectId = projectId.trim().slice(0, 8) || 'project';
  return `${sanitizeFilename(input)}-${shortProjectId}-yumcut.com`;
}

function buildImagePrankCatalogHref(categorySlug?: string | null, subcategorySlug?: string | null) {
  const params = new URLSearchParams({ openMode: 'image-prank' });
  const category = categorySlug?.trim();
  const subcategory = subcategorySlug?.trim();
  if (category) params.set('category', category);
  if (category && subcategory) params.set('subcategory', subcategory);
  return `/?${params.toString()}`;
}

function extensionFromContentType(type: string | null | undefined, fallback: string) {
  const lower = (type || '').toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  return fallback;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

async function decodeImageBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const url = window.URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      window.URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      window.URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    image.src = url;
  });
}

async function convertImageBlob(blob: Blob, format: Exclude<DownloadFormat, 'original'>) {
  const decoded = await decodeImageBlob(blob);
  const isHtmlImage = typeof HTMLImageElement !== 'undefined' && decoded instanceof HTMLImageElement;
  const width = isHtmlImage ? decoded.naturalWidth : decoded.width;
  const height = isHtmlImage ? decoded.naturalHeight : decoded.height;
  const mimeType = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
  const quality = format === 'jpg' ? 0.95 : format === 'webp' ? 0.98 : undefined;

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(decoded as CanvasImageSource, 0, 0);
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(decoded as CanvasImageSource, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((converted) => {
      if (converted) resolve(converted);
      else reject(new Error('Image conversion failed'));
    }, mimeType, quality);
  });
}

export function ImageGenerationProjectScreen({ project, projectId }: Props) {
  const { language } = useAppLanguage();
  const t = COPY[language];
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);
  const [zoomImage, setZoomImage] = useState<ZoomImage | null>(null);
  const image = project.imageGeneration ?? null;
  const isImagePrank = image?.kind === 'image-prank';
  const sourceImages = image?.sourceImages?.filter((source) => source.imageUrl) ?? [];
  const resultImageUrl = image?.resultImageUrl?.trim() || null;
  const prompt = image?.prompt?.trim() || project.prompt?.trim() || '';
  const progress = getProgressPercent(project, nowMs);
  const isProcessing = project.status !== ProjectStatus.Done && project.status !== ProjectStatus.Error && project.status !== ProjectStatus.Cancelled;
  const isError = project.status === ProjectStatus.Error;
  const refundedTokens = typeof project.tokensRefunded === 'number' ? Math.max(0, project.tokensRefunded) : 0;
  const errorRefundMessage = refundedTokens > 0 ? t.generationFailedRefund(refundedTokens) : t.generationFailedNoRefund;
  const remainingGenerationMs = getRemainingGenerationMs(project, nowMs);
  const progressCaption = isError
    ? t.generationFailed
    : remainingGenerationMs > 0
      ? t.progressCountdown(formatCountdown(remainingGenerationMs))
      : t.progressWaiting;
  const originalFormat = (image?.resultFormat || 'jpg').toLowerCase();
  const baseFilename = buildDownloadBaseFilename(prompt || project.title, projectId);
  const catalogItemHref = image?.catalogItem?.slug ? `/image-prank/${encodeURIComponent(image.catalogItem.slug)}` : null;
  const imagePrankRootHref = buildImagePrankCatalogHref();
  const categorySlug = image?.catalogItem?.categorySlug?.trim() || null;
  const categoryTitle = image?.catalogItem?.categoryTitle?.trim() || null;
  const subcategorySlug = image?.catalogItem?.subcategorySlug?.trim() || null;
  const subcategoryTitle = image?.catalogItem?.subcategoryTitle?.trim() || null;
  const categoryHref = categorySlug ? buildImagePrankCatalogHref(categorySlug) : null;
  const subcategoryHref = categorySlug && subcategorySlug ? buildImagePrankCatalogHref(categorySlug, subcategorySlug) : null;
  const reuseHref = isImagePrank
    ? `${catalogItemHref ?? '/image-prank/custom'}?reuseProjectId=${encodeURIComponent(projectId)}`
    : null;
  const sourceLabel = image?.source === 'global'
    ? t.catalogCharacter
    : image?.source === 'user'
      ? t.sourceImage
      : t.unknown;
  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = async (format: DownloadFormat) => {
    if (!resultImageUrl || downloading) return;
    setDownloading(format);
    try {
      const imageUrl = new URL(resultImageUrl, window.location.href);
      const response = await fetch(resultImageUrl, {
        credentials: imageUrl.origin === window.location.origin ? 'include' : 'omit',
      });
      if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
      const blob = await response.blob();
      if (format === 'original') {
        const ext = extensionFromContentType(blob.type, originalFormat === 'jpeg' ? 'jpg' : originalFormat);
        triggerBlobDownload(blob, `${baseFilename}.${ext}`);
      } else {
        const converted = await convertImageBlob(blob, format);
        triggerBlobDownload(converted, `${baseFilename}.${format}`);
      }
      setDownloadMenuOpen(false);
    } catch (err) {
      toast.error(t.downloadFailed, {
        description: err instanceof Error ? err.message : t.downloadFailedDescription,
      });
    } finally {
      setDownloading(null);
    }
  };

  const openZoomImage = (url: string | null | undefined, label: string) => {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl) return;
    setZoomImage({ url: normalizedUrl, label });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-xl font-semibold leading-6 text-gray-900 dark:text-gray-100">
            {project.title}
          </h1>
        </div>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t.projectActions}
              title={t.projectActions}
              className="cursor-pointer rounded-full"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(176px,calc(100vw-1rem))] p-1">
            <div
              role="menuitem"
              tabIndex={0}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span>{t.delete}</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b border-gray-200/80 pb-3 dark:border-gray-800/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            <ImageIcon className="h-4 w-4 text-blue-500" />
            {isImagePrank ? (
              <>
                <Link
                  href={imagePrankRootHref}
                  className="min-w-0 cursor-pointer rounded-sm hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-300"
                >
                  {t.imagePrank}
                </Link>
                {categoryTitle ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {categoryHref ? (
                      <Link
                        href={categoryHref}
                        className="min-w-0 cursor-pointer truncate rounded-sm hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-300"
                      >
                        {categoryTitle}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate">{categoryTitle}</span>
                    )}
                  </>
                ) : null}
                {subcategoryTitle ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {subcategoryHref ? (
                      <Link
                        href={subcategoryHref}
                        className="min-w-0 cursor-pointer truncate rounded-sm hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-300"
                      >
                        {subcategoryTitle}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate">{subcategoryTitle}</span>
                    )}
                  </>
                ) : null}
              </>
            ) : resultImageUrl
              ? t.generatedImage
              : isError
                ? t.generationFailed
                : t.generatingImage}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] lg:items-stretch">
            <div className="flex justify-center lg:justify-start">
              <div className="relative flex aspect-[9/16] w-full max-w-[360px] items-center justify-center overflow-hidden border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                {resultImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultImageUrl}
                      alt={t.generatedImage}
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute right-3 top-3 inline-flex rounded-lg shadow-sm">
                      <Button
                        type="button"
                        size="icon"
                        className="h-9 w-10 cursor-pointer rounded-r-none"
                        onClick={() => void handleDownload('original')}
                        disabled={downloading !== null}
                        aria-label={t.download}
                        title={t.download}
                      >
                        {downloading === 'original' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                      <Popover open={downloadMenuOpen} onOpenChange={setDownloadMenuOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            className="h-9 w-9 cursor-pointer rounded-l-none border-l border-white/25"
                            aria-label={t.download}
                            title={t.download}
                            disabled={downloading !== null}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[min(180px,calc(100vw-1rem))] p-1">
                          {([
                            ['original', t.downloadOriginal],
                            ['png', t.downloadPng],
                            ['jpg', t.downloadJpg],
                            ['webp', t.downloadWebp],
                          ] as Array<[DownloadFormat, string]>).map(([format, label]) => (
                            <button
                              key={format}
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                              onClick={() => void handleDownload(format)}
                              disabled={downloading !== null}
                            >
                              {downloading === format ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              <span>{label}</span>
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-5 text-center">
                    {isError ? (
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    ) : (
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    )}
                    <div className="w-full max-w-[260px] space-y-2">
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {isError ? t.generationFailed : t.generatingImage}
                      </div>
                      {isError ? (
                        <div className="space-y-1 text-sm leading-5 text-gray-600 dark:text-gray-400">
                          <p>{t.generationFailedAdminMessage}</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{errorRefundMessage}</p>
                        </div>
                      ) : (
                        <>
                          <div
                            className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                          >
                            <div
                              className="h-full rounded-full bg-blue-600 transition-[width] duration-700 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{progressCaption}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex h-full flex-col gap-4">
              <section className="rounded-lg border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    {t.prompt}
                  </h2>
                  <div className="inline-flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="inline-flex cursor-pointer items-center gap-1.5"
                      onClick={handleCopyPrompt}
                      disabled={!prompt}
                    >
                      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t.copied : t.copy}
                    </Button>
                    {reuseHref ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="inline-flex cursor-pointer items-center gap-1.5"
                        onClick={() => router.push(reuseHref)}
                      >
                        <Repeat2 className="h-3.5 w-3.5" />
                        {t.reuse}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-200">
                  {prompt || t.unknown}
                </div>
              </section>

              <section className="flex flex-1 flex-col rounded-lg border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <UserRound className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  {sourceImages.length > 0 ? t.referenceImages : t.sourceImage}
                </h2>
                {sourceImages.length > 0 ? (
                  <div className="grid flex-1 gap-3 md:grid-cols-2">
                    {sourceImages.map((source, index) => (
                      (() => {
                        const key = `${source.role}-${source.imagePath ?? source.imageUrl ?? index}`;
                        const isCatalogPrankCard = source.role === 'prank' && Boolean(catalogItemHref);
                        const cardContent = (
                          <>
                            <button
                              type="button"
                              className="group relative flex min-h-[240px] flex-1 cursor-pointer items-center justify-center overflow-hidden md:min-h-[300px]"
                              aria-label={`${t.zoomImage}: ${source.label || t.referenceImages}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openZoomImage(source.imageUrl || source.previewImageUrl, source.label || t.referenceImages);
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={source.previewImageUrl || source.imageUrl || ''}
                                alt={source.label || t.referenceImages}
                                className="h-full max-h-[360px] w-full object-contain"
                              />
                              <span
                                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-85 shadow-lg transition-opacity group-hover:opacity-100"
                                aria-hidden="true"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </span>
                            </button>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                {source.label || t.referenceImages}
                              </div>
                            </div>
                          </>
                        );

                        if (isCatalogPrankCard && catalogItemHref) {
                          return (
                            <div
                              key={key}
                              className="grid h-full cursor-pointer gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:bg-gray-900"
                              onClick={() => router.push(catalogItemHref)}
                            >
                              {cardContent}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={key}
                            className="grid h-full gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900/60"
                          >
                            {cardContent}
                          </div>
                        );
                      })()
                    ))}
                  </div>
                ) : image?.originalImageUrl ? (
                  <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <button
                      type="button"
                      className="group relative flex h-[160px] w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
                      aria-label={`${t.zoomImage}: ${t.sourceImage}`}
                      onClick={() => openZoomImage(image.originalImageUrl, t.sourceImage)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.originalImageUrl} alt={t.sourceImage} className="h-full w-full object-contain" />
                      <span
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-85 shadow-lg transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </span>
                    </button>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">{t.source}</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{sourceLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">{t.catalogCharacter}</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                          {[image.characterTitle, image.variationTitle].filter(Boolean).join(' · ') || t.unknown}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.noSourceImage}</p>
                )}
              </section>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent
          className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] border-0 bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-3rem)]"
          ariaDescription={zoomImage?.label ?? t.zoomImage}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{zoomImage?.label ?? t.zoomImage}</DialogTitle>
          </DialogHeader>
          {zoomImage ? (
            <div className="flex max-h-[calc(100vh-2rem)] w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomImage.url} alt={zoomImage.label} className="max-h-[calc(100vh-4rem)] max-w-full object-contain" />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteProjectTitle}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{t.deleteProjectDescription}</DialogDescription>
          <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm leading-5">{t.deleteProjectWarning}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" className="cursor-pointer">{t.cancel}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={async () => {
                try {
                  window.dispatchEvent(new CustomEvent('project:deleted', { detail: { projectId } }));
                  await Api.deleteProject(projectId);
                  setConfirmOpen(false);
                  router.push('/');
                } catch {
                  setConfirmOpen(false);
                  router.refresh();
                }
              }}
            >
              {t.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
