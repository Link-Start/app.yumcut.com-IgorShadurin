import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getProjectDetailForAdmin } from '@/server/admin/projects';
import { ProjectPromptCard } from '@/components/project/ProjectPromptCard';
import { ProjectSettingsBar } from '@/components/project/ProjectSettingsBar';
import { ProjectApprovedScriptCard } from '@/components/project/ProjectApprovedScriptCard';
import { ProjectApprovedAudioCard } from '@/components/project/ProjectApprovedAudioCard';
import { ProjectFinalVideoCard } from '@/components/project/ProjectFinalVideoCard';
import { ProjectErrorCard } from '@/components/project/ProjectErrorCard';
import { ProjectStatus } from '@/shared/constants/status';
import { statusLabel, statusDescription as describeStatus } from '@/shared/constants/status-info';
import { formatDateTimeAdmin } from '@/lib/date';
import Link from 'next/link';
import { AdminBackButton } from '@/components/admin/AdminBackButton';
import { AdminProjectStatusChanger } from '@/components/admin/AdminProjectStatusChanger';
import { AdminProjectErrorDetails } from '@/components/admin/AdminProjectErrorDetails';
import type { ProjectDetailDTO, ProjectLanguageProgressStateDTO } from '@/shared/types';
import type { ProjectErrorDetail, ProjectErrorLogFile } from '@/server/projects/errors';

function AdminImageProjectOverview({ project }: { project: ProjectDetailDTO }) {
  const image = project.imageGeneration;
  const resultUrl = image?.resultImageUrl?.trim() || null;
  const sourceImages = image?.sourceImages?.filter((source) => source.imageUrl || source.previewImageUrl) ?? [];
  const catalogHref = image?.catalogItem?.slug ? `/image-prank/${encodeURIComponent(image.catalogItem.slug)}` : null;
  const isProcessing = project.status !== ProjectStatus.Done && project.status !== ProjectStatus.Error && project.status !== ProjectStatus.Cancelled;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{image?.displayLabel || 'Image project'}</CardTitle>
        </CardHeader>
        <CardContent>
          {resultUrl ? (
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              className="flex cursor-pointer items-center justify-center border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Generated image"
                className="max-h-[680px] max-w-full object-contain"
              />
            </a>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              {project.status === ProjectStatus.Error
                ? 'Image generation failed.'
                : isProcessing
                  ? 'Image generation is in progress.'
                  : 'No generated image is attached.'}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-200">
            {image?.prompt || project.prompt || 'No prompt'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image data</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Kind</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{image?.kind || 'Image'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Model</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{image?.model || 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Size</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {image?.width && image?.height ? `${image.width}x${image.height}` : 'Unknown'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Format</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{image?.resultFormat || 'Unknown'}</dd>
              </div>
              {image?.catalogItem ? (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 dark:text-gray-400">Catalog item</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">
                    {catalogHref ? (
                      <Link href={catalogHref} className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400">
                        {image.catalogItem.title}
                      </Link>
                    ) : (
                      image.catalogItem.title
                    )}
                    {image.catalogItem.categoryTitle ? ` / ${image.catalogItem.categoryTitle}` : ''}
                    {image.catalogItem.subcategoryTitle ? ` / ${image.catalogItem.subcategoryTitle}` : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reference images</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceImages.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {sourceImages.map((source, index) => {
                  const imageUrl = source.imageUrl || source.previewImageUrl || '';
                  const isCatalogPrank = source.role === 'prank' && Boolean(catalogHref);
                  return (
                    <div key={`${source.role}-${source.imagePath ?? imageUrl ?? index}`} className="space-y-2">
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-[320px] cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={source.previewImageUrl || source.imageUrl || ''}
                          alt={source.label}
                          className="max-h-full max-w-full object-contain"
                        />
                      </a>
                      {isCatalogPrank && catalogHref ? (
                        <Link href={catalogHref} className="inline-block cursor-pointer text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                          {source.label}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{source.label}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">No reference images are attached.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatStatus(status: ProjectStatus) { return statusLabel(status); }

function isProjectErrorLogFile(value: unknown): value is ProjectErrorLogFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.path === 'string'
    && typeof candidate.content === 'string'
    && typeof candidate.sizeBytes === 'number'
    && typeof candidate.truncated === 'boolean'
    && (candidate.source === 'status-log-path' || candidate.source === 'template-launch');
}

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const detail = await getProjectDetailForAdmin(projectId);
  if (!detail) {
    notFound();
  }

  const { project, user, latestLogMessage, languageProgress, tokensUsed } = detail;
  const statusInfo = project.statusInfo as Record<string, unknown> | undefined;
  const statusLabel = formatStatus(project.status);
  const statusDescription = describeStatus(project.status);
  const languageVariants = project.languageVariants ?? [];
  const primaryLanguage = languageVariants.find((variant) => variant.isPrimary)?.languageCode
    ?? project.creation?.targetLanguage
    ?? project.languages?.[0]
    ?? 'en';
  const scriptFallback = project.finalScriptText
    || (typeof statusInfo?.scriptText === 'string' ? (statusInfo.scriptText as string) : null)
    || project.rawScript
    || null;
  const errorMessage = project.status === ProjectStatus.Error
    ? ((statusInfo?.message as string | undefined) ?? latestLogMessage ?? undefined)
    : undefined;
  const isImageGenerationProject = project.creation?.projectExperience === 'image-generation' || !!project.imageGeneration;
  const errorDescription = project.status === ProjectStatus.Error && isImageGenerationProject
    ? 'Admin will review this project and handle the issue.'
    : undefined;
  const errorOccurredAt = project.status === ProjectStatus.Error && typeof statusInfo?.occurredAt === 'string'
    ? statusInfo.occurredAt
    : null;
  const errorDetails = project.status === ProjectStatus.Error && Array.isArray(statusInfo?.errorDetails)
    ? (statusInfo.errorDetails as ProjectErrorDetail[])
    : [];
  const errorLogFile = project.status === ProjectStatus.Error && isProjectErrorLogFile(statusInfo?.errorLogFile)
    ? statusInfo.errorLogFile
    : null;
  const errorExtra = project.status === ProjectStatus.Error && statusInfo?.errorExtra && typeof statusInfo.errorExtra === 'object' && !Array.isArray(statusInfo.errorExtra)
    ? statusInfo.errorExtra as Record<string, unknown>
    : null;
  const fallbackFinalVideo = project.finalVideoUrl ?? project.finalVideoPath ?? null;
  const failedVideoLanguages = Array.isArray(statusInfo?.failedLanguages)
    ? (statusInfo?.failedLanguages as Array<string | null | undefined>).filter(Boolean).map(String)
    : [];
  const videoLogs = statusInfo?.videoLogs && typeof statusInfo.videoLogs === 'object'
    ? statusInfo.videoLogs as Record<string, string | null | undefined>
    : undefined;
  const videoErrors = statusInfo?.videoErrors && typeof statusInfo.videoErrors === 'object'
    ? statusInfo.videoErrors as Record<string, string | null | undefined>
    : undefined;

  const progressMap = new Map((languageProgress ?? []).map((row) => [row.languageCode, row]));
  const selectableLanguages: ProjectLanguageProgressStateDTO[] = Array.from(new Set([
    ...(project.languages ?? []),
    ...languageVariants.map((variant) => variant.languageCode),
    ...(languageProgress ?? []).map((row) => row.languageCode),
  ]))
    .filter((code): code is string => typeof code === 'string' && code.length > 0)
    .map((languageCode) => progressMap.get(languageCode) ?? {
      languageCode,
      transcriptionDone: false,
      captionsDone: false,
      videoPartsDone: false,
      finalVideoDone: false,
      disabled: false,
      failedStep: null,
      failureReason: null,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Created {formatDateTimeAdmin(project.createdAt)}
            <span className="mx-1">•</span>
            Updated {formatDateTimeAdmin(project.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{statusLabel}</Badge>
          <Badge className="border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Used {tokensUsed.toLocaleString()} tokens
          </Badge>
          <Link
            href={`/admin/users/${user.id}`}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {user.name || user.email}
          </Link>
        </div>
      </div>
      <AdminBackButton className="w-fit" />

      {/* Admin-only status changer below the back button */}
      <AdminProjectStatusChanger
        projectId={project.id}
        current={project.status}
        languages={selectableLanguages}
        projectExperience={project.creation?.projectExperience}
      />

      {statusDescription ? (
        <Card>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            {statusDescription}
          </CardContent>
        </Card>
      ) : null}

      {errorMessage ? <ProjectErrorCard message={errorMessage} description={errorDescription} /> : null}
      <AdminProjectErrorDetails occurredAt={errorOccurredAt} details={errorDetails} logFile={errorLogFile} extra={errorExtra} />
      {isImageGenerationProject ? (
        <AdminImageProjectOverview project={project} />
      ) : (
        <>
          <ProjectFinalVideoCard
            variants={languageVariants}
            primaryLanguage={primaryLanguage}
            projectStatus={project.status}
            fallbackUrl={fallbackFinalVideo}
            title={project.title}
            projectId={project.id}
            failedLanguages={failedVideoLanguages}
            videoLogs={videoLogs}
            videoErrors={videoErrors}
          />

          <ProjectPromptCard
            prompt={project.prompt}
            rawScript={project.rawScript}
            settings={project.creation ? <ProjectSettingsBar creation={project.creation} /> : undefined}
          />

          <ProjectApprovedScriptCard
            variants={languageVariants}
            primaryLanguage={primaryLanguage}
            fallbackText={scriptFallback}
            title={project.title}
          />

          <ProjectApprovedAudioCard
            variants={languageVariants}
            primaryLanguage={primaryLanguage}
            fallbackUrl={project.finalVoiceoverPath}
            title={project.title}
          />
        </>
      )}
    </div>
  );
}
