import { NextRequest } from 'next/server';
import { ok, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { prisma } from '@/server/db';
import { normalizeMediaUrl } from '@/server/storage';
import { normalizeLanguageList, DEFAULT_LANGUAGE } from '@/shared/constants/languages';
import { ProjectStatus } from '@/shared/constants/status';
import type { MobileProjectDetailDTO } from '@/shared/types';
import { requireMobileUserId } from '../../shared/auth';

async function buildDetail(projectId: string, userId: string): Promise<MobileProjectDetailDTO | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId, deleted: false },
    select: {
      id: true,
      title: true,
      prompt: true,
      status: true,
      createdAt: true,
      finalVideoUrl: true,
      finalVideoPath: true,
      languages: true,
      videos: {
        where: { isFinal: true },
        select: {
          languageCode: true,
          publicUrl: true,
          path: true,
          isFinal: true,
          variant: true,
        },
      },
    },
  });
  if (!project) {
    return null;
  }
  const languages = normalizeLanguageList((project as any).languages ?? DEFAULT_LANGUAGE, DEFAULT_LANGUAGE);
  const videos = project.videos ?? [];
  const languageVariants = languages.map((languageCode, index) => {
    const isPrimary = index === 0;
    const match = videos.find((v) => v.isFinal && (v.languageCode ?? languages[0]) === languageCode)
      ?? (isPrimary ? videos.find((v) => v.isFinal && !v.languageCode) : undefined);
    const finalVideoPath = match ? match.publicUrl || normalizeMediaUrl(match.path) : null;
    const finalVideoUrl = match ? match.publicUrl || null : null;
    const rawMatch = videos.find((v) => v.variant === 'raw' && (v.languageCode ?? languages[0]) === languageCode)
      ?? (isPrimary ? videos.find((v) => v.variant === 'raw' && !v.languageCode) : undefined);
    const rawVideoPath = rawMatch ? rawMatch.publicUrl || normalizeMediaUrl(rawMatch.path) : null;
    const rawVideoUrl = rawMatch ? rawMatch.publicUrl || null : null;
    return {
      languageCode,
      isPrimary,
      finalVideoPath,
      finalVideoUrl,
      rawVideoPath,
      rawVideoUrl,
    };
  });

  const primaryVariant = languageVariants[0];
  const finalVideoUrl =
    primaryVariant?.finalVideoUrl
    ?? project.finalVideoUrl
    ?? normalizeMediaUrl(project.finalVideoPath ?? null)
    ?? primaryVariant?.finalVideoPath
    ?? null;
  const rawVideoPath = primaryVariant?.rawVideoPath ?? null;
  const rawVideoUrl = primaryVariant?.rawVideoUrl ?? rawVideoPath;

  return {
    id: project.id,
    title: project.title,
    prompt: project.prompt ?? '',
    status: project.status as ProjectStatus,
    createdAt: project.createdAt.toISOString(),
    languages,
    finalVideoUrl,
    rawVideoPath,
    rawVideoUrl,
    languageVariants,
  };
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const auth = await requireMobileUserId(req);
  if ('error' in auth) {
    return auth.error;
  }
  const { projectId } = await params;
  const detail = await buildDetail(projectId, auth.userId);
  if (!detail) {
    return notFound('Project not found');
  }
  return ok(detail);
}, 'Failed to load mobile project');
