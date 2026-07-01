import { prisma } from '@/server/db';
import { ProjectStatus } from '@/shared/constants/status';
import { normalizeMediaUrl } from '@/server/storage';
import { buildProjectErrorStatusInfo, getLatestErrorLog, getProjectErrorLogFileForAdmin } from '@/server/projects/errors';
import { normalizeLanguageList, DEFAULT_LANGUAGE } from '@/shared/constants/languages';
import { sortAudioCandidatesByCreatedAtDesc } from '@/server/projects/helpers';
import { normalizeLanguageVoiceMap } from '@/shared/voices/language-voice-map';
import { calculateProjectTokenCost, TOKEN_COSTS, TOKEN_TRANSACTION_TYPES } from '@/shared/constants/token-costs';
import { normalizeProjectExperience, type ProjectExperience } from '@/shared/constants/project-experience';
import { defaultCharacterVideoGeneration } from '@/shared/constants/video-generation';
import {
  CHARACTER_VIDEO_QUALITY_TO_GENERATION_MODE,
  normalizeCharacterVideoGenerationMode,
  normalizeCharacterVideoQuality,
  qualityForVideoGenerationMode,
} from '@/shared/constants/character-video-quality';
import {
  PROJECT_ACTION_TOKEN_TYPES,
  PROJECT_RELATED_TOKEN_TYPES,
  extractProjectIdFromTokenMetadata,
  toUsedTokensFromDelta,
} from '@/server/admin/token-usage';
import type { ImagePrankMode, ImagePrankSourceImageDTO, ProjectDetailDTO } from '@/shared/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveProjectExperienceFromPayload(payload: unknown): ProjectExperience {
  const record = isRecord(payload) ? payload : {};
  const normalized = normalizeProjectExperience(record.projectExperience);
  if (
    normalized === 'image-generation'
    || isRecord(record.imagePrank)
    || record.imageKind === 'image-prank'
  ) {
    return 'image-generation';
  }
  return normalized;
}

function normalizeImagePrankMode(value: unknown): ImagePrankMode | null {
  return value === 'catalog' || value === 'custom-two-image' || value === 'custom-one-image'
    ? value
    : null;
}

function inferImageFormat(reference: string | null | undefined): string | null {
  if (!reference) return null;
  const clean = reference.split('?')[0] ?? reference;
  const match = clean.match(/\.([a-z0-9]+)$/i);
  const ext = match?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'jpg' || ext === 'png' || ext === 'webp') return ext;
  return null;
}

export interface ListProjectsOptions {
  page?: number;
  pageSize?: number;
}

export async function listProjects(options: ListProjectsOptions = {}) {
  const take = Math.min(Math.max(options.pageSize ?? 20, 1), 50);
  const page = Math.max(Math.floor(options.page ?? 1), 1);
  const skip = (page - 1) * take;

  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true } },
        selection: { select: { characterId: true, userCharacterId: true } },
      },
    }),
    prisma.project.count({ where: { deleted: false } }),
  ]);

  // Detect dynamic choice for projects without a selection yet by looking at the earliest job payload
  const ids = items.map((p) => p.id);
  const jobsByProject = new Map<string, any>();
  for (const id of ids) {
    const j = await prisma.job.findFirst({ where: { projectId: id }, orderBy: { createdAt: 'asc' }, select: { payload: true } });
    jobsByProject.set(id, j?.payload || null);
  }

  return {
    items: items.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status as ProjectStatus,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      user: {
        id: p.user.id,
        email: p.user.email,
        name: p.user.name,
      },
      characterKind: p.selection?.userCharacterId ? 'user' : p.selection?.characterId ? 'global' : ((jobsByProject.get(p.id) as any)?.characterSelection?.source === 'dynamic' ? 'dynamic' : null),
    })),
    page,
    pageSize: take,
    total,
    totalPages: Math.max(Math.ceil(total / take), 1),
  };
}

export interface AdminProjectDetailResult {
  project: import('@/shared/types').ProjectDetailDTO;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  latestLogMessage: string | null;
  languageProgress: import('@/shared/types').ProjectLanguageProgressStateDTO[];
  tokensUsed: number;
}

export async function getProjectDetailForAdmin(projectId: string): Promise<AdminProjectDetailResult | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      scripts: true,
      audios: true,
      videos: true,
      images: { orderBy: { createdAt: 'desc' } },
      statusLog: { orderBy: { createdAt: 'desc' }, take: 1 },
      selection: true,
    },
  });
  if (!p || p.deleted) return null;

  const initialJob = await prisma.job.findFirst({
    where: { projectId: p.id },
    orderBy: { createdAt: 'asc' },
  });

  const languages = normalizeLanguageList(
    (p as any)?.languages
      ?? (initialJob?.payload as any)?.languages
      ?? (initialJob?.payload as any)?.targetLanguage
      ?? DEFAULT_LANGUAGE,
    DEFAULT_LANGUAGE,
  );
  const primaryLanguage = languages[0] ?? DEFAULT_LANGUAGE;
  const scripts = (p as any).scripts as Array<{ languageCode: string; text: string }> | undefined;
  const audios = (p as any).audios as Array<{
    id: string;
    path: string;
    publicUrl?: string | null;
    localPath?: string | null;
    languageCode?: string | null;
    isFinal?: boolean | null;
    createdAt?: Date | string | null;
  }> | undefined;
  const videos = (p as any).videos as Array<{ id: string; path: string; publicUrl?: string | null; isFinal?: boolean; languageCode?: string | null }> | undefined;
  const primaryScript = scripts?.find((s) => s.languageCode === primaryLanguage) ?? scripts?.[0] ?? null;
  const projectExperience = resolveProjectExperienceFromPayload(initialJob?.payload);

  const languageVariants = languages.map((languageCode, index) => {
    const isPrimary = index === 0;
    const scriptRecord = scripts?.find((s) => s.languageCode === languageCode) ?? null;
    const audioCandidates = sortAudioCandidatesByCreatedAtDesc(
      (audios ?? []).filter((a) => ((a.languageCode ?? primaryLanguage) === languageCode)),
    )
      .map((a) => ({
        id: a.id,
        path: a.publicUrl || normalizeMediaUrl(a.path) || a.path || '',
        languageCode,
        url: a.publicUrl || normalizeMediaUrl(a.path) || null,
        isFinal: (a as any).isFinal === true,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt ?? null,
      }));

    let finalVoiceoverPath: string | null = null;
    let finalVoiceoverUrl: string | null = null;
    const finalCandidate = (audios ?? []).find((a) => (a.languageCode ?? primaryLanguage) === languageCode && (a as any).isFinal);
    if (finalCandidate) {
      finalVoiceoverPath = finalCandidate.publicUrl || normalizeMediaUrl(finalCandidate.path);
      finalVoiceoverUrl = finalCandidate.publicUrl || null;
    } else if ((p as any).finalVoiceoverId) {
      const match = (audios ?? []).find((a) => a.id === (p as any).finalVoiceoverId && ((a.languageCode ?? primaryLanguage) === languageCode));
      if (match) {
        finalVoiceoverPath = match.publicUrl || normalizeMediaUrl(match.path);
        finalVoiceoverUrl = match.publicUrl || null;
      }
    }
    if (!finalVoiceoverPath && isPrimary) {
      finalVoiceoverPath = (p as any).finalVoiceoverUrl
        || normalizeMediaUrl((p as any).finalVoiceoverPath ?? null);
      finalVoiceoverUrl = (p as any).finalVoiceoverUrl ?? null;
    }

    const finalVideoRecord =
      (videos ?? []).find((v) => v.languageCode === languageCode && v.isFinal)
      ?? (isPrimary ? (videos ?? []).find((v) => v.isFinal && !v.languageCode) : undefined);
    const finalVideoPath = finalVideoRecord ? (finalVideoRecord.publicUrl || normalizeMediaUrl(finalVideoRecord.path)) : null;
    const finalVideoUrl = finalVideoRecord ? finalVideoRecord.publicUrl || null : null;

    return {
      languageCode,
      isPrimary,
      scriptText: scriptRecord?.text ?? null,
      audioCandidates,
      finalVoiceoverPath,
      finalVoiceoverUrl,
      finalVideoPath,
      finalVideoUrl,
    };
  });

  const status = p.status as ProjectStatus;
  const latestLog = p.statusLog[0];
  const baseStatusInfo = ((latestLog?.extra as any) && typeof latestLog.extra === 'object' && !Array.isArray(latestLog.extra))
    ? { ...(latestLog.extra as Record<string, unknown>) }
    : {};
  let statusInfo: Record<string, unknown> | undefined;

  switch (status) {
    case ProjectStatus.ProcessScriptValidate:
      statusInfo = {
        scriptText: primaryScript?.text || '',
        languageCode: primaryScript?.languageCode ?? primaryLanguage,
        ...(languageVariants.length ? { languageVariants } : {}),
      };
      break;
    case ProjectStatus.ProcessAudioValidate: {
      const sortedAdminAudios = sortAudioCandidatesByCreatedAtDesc(audios ?? []);
      statusInfo = {
        audioCandidates: sortedAdminAudios.map((a) => ({
          id: a.id,
          path: a.publicUrl || normalizeMediaUrl(a.path),
          languageCode: a.languageCode ?? primaryLanguage,
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt ?? null,
        })),
        ...(languageVariants.length ? { languageVariants } : {}),
      };
      break;
    }
    case ProjectStatus.Error: {
      const errorLog = await getLatestErrorLog(prisma, p.id);
      const errorInfo = buildProjectErrorStatusInfo(errorLog, latestLog, { includeExtra: true });
      const errorLogFile = await getProjectErrorLogFileForAdmin(p.id, errorInfo.errorExtra ?? null);
      statusInfo = {
        ...errorInfo,
        ...(errorLogFile ? { errorLogFile } : {}),
      };
      break;
    }
    case ProjectStatus.Done: {
      if (projectExperience === 'image-generation') {
        const finalImage = (p as any).images?.[0] ?? null;
        const finalImageUrl =
          typeof baseStatusInfo.finalImageUrl === 'string'
            ? baseStatusInfo.finalImageUrl
            : (finalImage?.publicUrl || normalizeMediaUrl(finalImage?.path ?? null));
        statusInfo = {
          ...baseStatusInfo,
          finalImageUrl,
          finalImagePath: baseStatusInfo.finalImagePath ?? finalImage?.path ?? null,
        };
      } else {
        const finalVariant = languageVariants.find((variant) => variant.isPrimary && variant.finalVideoUrl)
          ?? languageVariants.find((variant) => variant.finalVideoUrl)
          ?? null;
        const finalUrl = finalVariant?.finalVideoUrl
          || (p as any).finalVideoUrl
          || normalizeMediaUrl((p as any).finalVideoPath ?? null);
        statusInfo = {
          url: finalUrl,
          ...(languageVariants.length ? { languageVariants } : {}),
        };
      }
      break;
    }
    default: {
      statusInfo = languageVariants.length ? { ...baseStatusInfo, languageVariants } : baseStatusInfo;
      break;
    }
  }

  let characterTitle: string | null = null;
  let variationTitle: string | null = null;
  let characterImageUrl: string | null = null;
  let selectionStatus: 'ready' | 'processing' | 'failed' | null = null;
  let autoGenerated = false;
  if (p.selection?.characterId) {
    const char = await prisma.character.findUnique({ where: { id: p.selection.characterId } });
    const variation = p.selection.characterVariationId
      ? await prisma.characterVariation.findUnique({ where: { id: p.selection.characterVariationId } })
      : null;
    characterTitle = char?.title || null;
    variationTitle = variation?.title || null;
    if ((variation as any)?.imagePath) {
      characterImageUrl = normalizeMediaUrl((variation as any).imagePath);
    }
    selectionStatus = 'ready';
  } else if (p.selection?.userCharacterId) {
    const char = await prisma.userCharacter.findFirst({ where: { id: p.selection.userCharacterId, deleted: false } });
    const variation = p.selection.userCharacterVariationId
      ? await prisma.userCharacterVariation.findFirst({
          where: { id: p.selection.userCharacterVariationId, deleted: false },
          select: { id: true, title: true, imagePath: true, imageUrl: true, status: true, source: true },
        })
      : null;
    characterTitle = char?.title || null;
    variationTitle = variation?.title || null;
    characterImageUrl = normalizeMediaUrl((variation as any)?.imagePath ?? (variation as any)?.imageUrl ?? null);
    selectionStatus = ((variation as any)?.status as 'ready' | 'processing' | 'failed') ?? null;
    autoGenerated = ((variation as any)?.source === 'daemon');
  }

  const payloadVideoGeneration = (initialJob?.payload as any)?.videoGeneration;
  const payloadVideoGenerationMode = normalizeCharacterVideoGenerationMode(payloadVideoGeneration?.mode);
  const characterVideoQuality = projectExperience === 'character'
    ? (payloadVideoGenerationMode
      ? qualityForVideoGenerationMode(payloadVideoGenerationMode)
      : normalizeCharacterVideoQuality((initialJob?.payload as any)?.characterVideoQuality))
    : undefined;
  const resolvedVideoGenerationMode = projectExperience === 'character'
    ? (payloadVideoGenerationMode ?? CHARACTER_VIDEO_QUALITY_TO_GENERATION_MODE[characterVideoQuality ?? 'high'])
    : null;
  const resolvedVideoGeneration = resolvedVideoGenerationMode
    ? {
        mode: resolvedVideoGenerationMode,
        ...(resolvedVideoGenerationMode === 'lipsync_runware'
          ? {
              lipsyncPrompt: typeof payloadVideoGeneration?.lipsyncPrompt === 'string' && payloadVideoGeneration.lipsyncPrompt.trim()
                ? payloadVideoGeneration.lipsyncPrompt.trim()
                : defaultCharacterVideoGeneration().lipsyncPrompt,
            }
          : {}),
      }
    : null;
  const creation = initialJob?.payload ? {
    durationSeconds: (initialJob.payload as any).durationSeconds ?? null,
    useExactTextAsScript: (initialJob.payload as any).useExactTextAsScript ?? null,
    includeDefaultMusic: (initialJob.payload as any).includeDefaultMusic ?? null,
    addOverlay: (initialJob.payload as any).addOverlay ?? null,
    autoApproveScript: (initialJob.payload as any).autoApproveScript ?? null,
    autoApproveAudio: (initialJob.payload as any).autoApproveAudio ?? null,
    watermarkEnabled: (initialJob.payload as any).watermarkEnabled ?? null,
    captionsEnabled: (initialJob.payload as any).captionsEnabled ?? null,
    scriptCreationGuidanceEnabled: (initialJob.payload as any).scriptCreationGuidanceEnabled ?? null,
    scriptCreationGuidance: (initialJob.payload as any).scriptCreationGuidance ?? null,
    scriptAvoidanceGuidanceEnabled: (initialJob.payload as any).scriptAvoidanceGuidanceEnabled ?? null,
    scriptAvoidanceGuidance: (initialJob.payload as any).scriptAvoidanceGuidance ?? null,
    audioStyleGuidanceEnabled: (initialJob.payload as any).audioStyleGuidanceEnabled ?? null,
    audioStyleGuidance: (initialJob.payload as any).audioStyleGuidance ?? null,
    targetLanguage: primaryLanguage,
    languages,
    languageVoiceAssignments: normalizeLanguageVoiceMap(
      (initialJob.payload as any)?.languageVoices
      ?? (p as any)?.languageVoiceAssignments
      ?? null,
    ),
    characterVideoQuality,
    videoGeneration: resolvedVideoGeneration,
    projectExperience,
    characterSelection: p.selection
      ? p.selection.userCharacterId
        ? {
            type: 'user' as const,
            userCharacterId: p.selection.userCharacterId,
            variationId: p.selection.userCharacterVariationId,
            characterTitle,
            variationTitle,
            imageUrl: characterImageUrl,
            generated: autoGenerated,
            status: selectionStatus,
          }
        : p.selection.characterId
        ? {
            type: 'global' as const,
            characterId: p.selection.characterId,
            variationId: p.selection.characterVariationId,
            characterTitle,
            variationTitle,
            imageUrl: characterImageUrl,
            status: 'ready',
          }
        : null
      : (initialJob.payload as any).characterSelection ?? null,
  } : undefined;

  const anyProject = p as any;
  const finalScriptText = anyProject.finalScriptText
    ?? (status !== ProjectStatus.ProcessScriptValidate ? (primaryScript?.text ?? null) : null);

  const primaryVariant = languageVariants.find((variant) => variant.languageCode === primaryLanguage) ?? languageVariants[0] ?? null;
  const finalVideoUrl = primaryVariant?.finalVideoUrl
    ?? anyProject.finalVideoUrl
    ?? null;
  const finalVideoPath =
    primaryVariant?.finalVideoPath
    ?? normalizeMediaUrl(anyProject.finalVideoPath ?? null)
    ?? finalVideoUrl;
  const finalVoiceoverPath =
    primaryVariant?.finalVoiceoverPath
    ?? anyProject.finalVoiceoverUrl
    ?? normalizeMediaUrl(
      anyProject.finalVoiceoverPath
      ?? (anyProject.finalVoiceoverId
        ? (p.audios.find((a: any) => a.id === anyProject.finalVoiceoverId)?.path || null)
        : null),
    );

  const progressRows = await prisma.projectLanguageProgress.findMany({ where: { projectId: p.id } });
  const languageProgress = progressRows.map((row) => ({
    languageCode: row.languageCode,
    transcriptionDone: row.transcriptionDone,
    captionsDone: row.captionsDone,
    videoPartsDone: row.videoPartsDone,
    finalVideoDone: row.finalVideoDone,
    disabled: row.disabled,
    failedStep: row.failedStep,
    failureReason: row.failureReason,
  }));

  const projectRelatedTokenTransactions = await prisma.tokenTransaction.findMany({
    where: {
      userId: p.userId,
      type: { in: [...PROJECT_RELATED_TOKEN_TYPES] },
    },
    select: {
      type: true,
      delta: true,
      metadata: true,
    },
  });
  const projectScopedRows = projectRelatedTokenTransactions.filter(
    (tx) => extractProjectIdFromTokenMetadata(tx.metadata) === p.id,
  );
  const projectDeltaFromLedger = projectScopedRows.reduce((sum, tx) => sum + tx.delta, 0);
  const hasExplicitProjectCreationCharge = projectScopedRows.some(
    (tx) => tx.type === PROJECT_RELATED_TOKEN_TYPES[0],
  );

  const actionDeltaForProject = projectScopedRows.reduce((sum, tx) => {
    if (![...PROJECT_ACTION_TOKEN_TYPES].includes(tx.type as any)) return sum;
    return sum + tx.delta;
  }, 0);
  const actionTokensUsed = toUsedTokensFromDelta(actionDeltaForProject);
  const imageGenerationDeltaForProject = projectScopedRows.reduce((sum, tx) => {
    if (
      tx.type !== TOKEN_TRANSACTION_TYPES.imageGeneration
      && tx.type !== TOKEN_TRANSACTION_TYPES.projectFailureRefund
    ) {
      return sum;
    }
    return sum + tx.delta;
  }, 0);
  const tokensRefunded = projectScopedRows.reduce((sum, tx) => {
    if (tx.type !== TOKEN_TRANSACTION_TYPES.projectFailureRefund) return sum;
    return sum + Math.max(0, tx.delta);
  }, 0);
  const hasExplicitImageGenerationCharge = projectScopedRows.some(
    (tx) => tx.type === TOKEN_TRANSACTION_TYPES.imageGeneration,
  );
  const estimatedCreationTokens = calculateProjectTokenCost(
    typeof (initialJob?.payload as any)?.durationSeconds === 'number'
      ? (initialJob?.payload as any).durationSeconds
      : null,
  ) * Math.max(languages.length, 1);
  const tokensUsed = projectExperience === 'image-generation'
    ? (hasExplicitImageGenerationCharge
      ? toUsedTokensFromDelta(imageGenerationDeltaForProject)
      : TOKEN_COSTS.actions.imageGeneration)
    : hasExplicitProjectCreationCharge
      ? toUsedTokensFromDelta(projectDeltaFromLedger)
      : Math.max(0, estimatedCreationTokens + actionTokensUsed);

  const initialPayload = (initialJob?.payload as any) ?? {};
  const imageStatusInfo = statusInfo as Record<string, any> | undefined;
  const payloadImagePrank = initialPayload?.imagePrank && typeof initialPayload.imagePrank === 'object'
    ? initialPayload.imagePrank
    : null;
  const statusImagePrank = imageStatusInfo?.imagePrank && typeof imageStatusInfo.imagePrank === 'object'
    ? imageStatusInfo.imagePrank
    : null;
  const resolvedImagePrank = statusImagePrank ?? payloadImagePrank;
  const sourceImages: ImagePrankSourceImageDTO[] = Array.isArray(resolvedImagePrank?.sourceImages)
    ? resolvedImagePrank.sourceImages.map((entry: any) => ({
        role: entry?.role === 'prank' || entry?.role === 'target' || entry?.role === 'reference' ? entry.role : 'reference',
        label: typeof entry?.label === 'string' && entry.label.trim() ? entry.label.trim() : 'Reference image',
        imageUrl: typeof entry?.imageUrl === 'string' && entry.imageUrl.trim()
          ? entry.imageUrl
          : normalizeMediaUrl(typeof entry?.imagePath === 'string' ? entry.imagePath : null),
        imagePath: typeof entry?.imagePath === 'string' ? entry.imagePath : null,
        previewImageUrl: typeof entry?.previewImageUrl === 'string' && entry.previewImageUrl.trim()
          ? entry.previewImageUrl
          : normalizeMediaUrl(typeof entry?.previewImagePath === 'string' ? entry.previewImagePath : null),
        previewImagePath: typeof entry?.previewImagePath === 'string' ? entry.previewImagePath : null,
        width: typeof entry?.width === 'number' ? entry.width : null,
        height: typeof entry?.height === 'number' ? entry.height : null,
      }))
    : [];
  let catalogItem: NonNullable<ProjectDetailDTO['imageGeneration']>['catalogItem'] = resolvedImagePrank?.catalogItem && typeof resolvedImagePrank.catalogItem === 'object'
    ? {
        id: typeof resolvedImagePrank.catalogItem.id === 'string' ? resolvedImagePrank.catalogItem.id : '',
        slug: typeof resolvedImagePrank.catalogItem.slug === 'string' ? resolvedImagePrank.catalogItem.slug : '',
        title: typeof resolvedImagePrank.catalogItem.title === 'string' ? resolvedImagePrank.catalogItem.title : 'Image Prank',
        categorySlug: typeof resolvedImagePrank.catalogItem.categorySlug === 'string' ? resolvedImagePrank.catalogItem.categorySlug : null,
        categoryTitle: typeof resolvedImagePrank.catalogItem.categoryTitle === 'string' ? resolvedImagePrank.catalogItem.categoryTitle : null,
        subcategorySlug: typeof resolvedImagePrank.catalogItem.subcategorySlug === 'string' ? resolvedImagePrank.catalogItem.subcategorySlug : null,
        subcategoryTitle: typeof resolvedImagePrank.catalogItem.subcategoryTitle === 'string' ? resolvedImagePrank.catalogItem.subcategoryTitle : null,
      }
    : null;
  if (catalogItem?.id) {
    const catalogRecord = await prisma.imagePrankItem.findFirst({
      where: { id: catalogItem.id },
      include: {
        category: true,
        subcategory: true,
      },
    });
    if (catalogRecord?.category) {
      catalogItem = {
        ...catalogItem,
        slug: catalogRecord.slug || catalogItem.slug,
        title: catalogRecord.titleEn || catalogRecord.titleRu || catalogItem.title,
        categorySlug: catalogRecord.category.slug,
        categoryTitle: catalogRecord.category.titleEn || catalogRecord.category.titleRu || catalogItem.categoryTitle,
        subcategorySlug: catalogRecord.subcategory?.slug ?? null,
        subcategoryTitle: catalogRecord.subcategory
          ? catalogRecord.subcategory.titleEn || catalogRecord.subcategory.titleRu || catalogItem.subcategoryTitle
          : null,
      };
    }
  }
  const imageAssets = Array.isArray((anyProject as any).images)
    ? (anyProject as any).images as Array<{ id: string; path: string; publicUrl?: string | null; createdAt?: Date }>
    : [];
  const resultImageAsset = imageAssets[0] ?? null;
  const imageKind = typeof initialPayload.imageKind === 'string'
    ? initialPayload.imageKind
    : (typeof imageStatusInfo?.imageKind === 'string' ? imageStatusInfo.imageKind : 'standalone');
  const displayPrompt = typeof imageStatusInfo?.userPrompt === 'string' && imageStatusInfo.userPrompt.trim()
    ? imageStatusInfo.userPrompt
    : (typeof initialPayload.userPrompt === 'string' && initialPayload.userPrompt.trim()
      ? initialPayload.userPrompt
      : String(initialPayload.prompt ?? p.prompt ?? ''));
  const imageGeneration: ProjectDetailDTO['imageGeneration'] = projectExperience === 'image-generation'
    ? {
        kind: imageKind === 'image-prank' ? 'image-prank' : 'standalone',
        mode: imageKind === 'image-prank' ? normalizeImagePrankMode(resolvedImagePrank?.mode) : null,
        displayLabel: imageKind === 'image-prank' ? 'Image Prank' : 'Image',
        prompt: displayPrompt,
        userPrompt: displayPrompt,
        provider: typeof initialPayload?.provider === 'string'
          ? initialPayload.provider
          : (typeof imageStatusInfo?.provider === 'string' ? imageStatusInfo.provider : null),
        model: typeof initialPayload?.model === 'string'
          ? initialPayload.model
          : (typeof imageStatusInfo?.model === 'string' ? imageStatusInfo.model : null),
        width: typeof initialPayload?.width === 'number'
          ? initialPayload.width
          : (typeof imageStatusInfo?.width === 'number' ? imageStatusInfo.width : null),
        height: typeof initialPayload?.height === 'number'
          ? initialPayload.height
          : (typeof imageStatusInfo?.height === 'number' ? imageStatusInfo.height : null),
        resultImageUrl:
          (typeof imageStatusInfo?.finalImageUrl === 'string' && imageStatusInfo.finalImageUrl.trim())
            ? imageStatusInfo.finalImageUrl
            : (resultImageAsset?.publicUrl || normalizeMediaUrl(resultImageAsset?.path ?? null)),
        resultImagePath:
          (typeof imageStatusInfo?.finalImagePath === 'string' && imageStatusInfo.finalImagePath.trim())
            ? imageStatusInfo.finalImagePath
            : (resultImageAsset?.path ?? null),
        resultFormat:
          (typeof imageStatusInfo?.resultFormat === 'string' && imageStatusInfo.resultFormat.trim())
            ? imageStatusInfo.resultFormat
            : inferImageFormat(
                (typeof imageStatusInfo?.finalImagePath === 'string' ? imageStatusInfo.finalImagePath : null)
                ?? resultImageAsset?.path
                ?? resultImageAsset?.publicUrl
                ?? null,
              ),
        originalImageUrl: characterImageUrl,
        characterTitle,
        variationTitle,
        source: p.selection?.userCharacterId ? 'user' : p.selection?.characterId ? 'global' : null,
        sourceImages,
        catalogItem,
        estimatedDurationSeconds:
          typeof initialPayload?.estimatedDurationSeconds === 'number'
            ? initialPayload.estimatedDurationSeconds
            : 300,
        startedAt:
          (typeof imageStatusInfo?.progressStartedAt === 'string' && imageStatusInfo.progressStartedAt)
            || p.createdAt.toISOString(),
      }
    : null;

  return {
    project: {
      id: p.id,
      userId: p.userId,
      title: p.title,
      prompt: p.prompt,
      rawScript: p.rawScript,
      finalScriptText,
      finalVoiceoverPath,
      finalVideoPath,
      finalVideoUrl,
      status,
      statusInfo,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      languages,
      languageVariants,
      creation,
      languageProgress,
      imageGeneration,
      tokensUsed,
      tokensRefunded,
    },
    user: {
      id: p.user.id,
      email: p.user.email,
      name: p.user.name,
    },
    latestLogMessage: (status === ProjectStatus.Error
      ? buildProjectErrorStatusInfo(await getLatestErrorLog(prisma, p.id), latestLog).message
      : latestLog?.message) || null,
    languageProgress,
    tokensUsed,
  };
}
