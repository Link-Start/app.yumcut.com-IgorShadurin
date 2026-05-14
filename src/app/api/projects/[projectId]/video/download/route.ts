import { NextRequest } from 'next/server';
import path from 'node:path';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, notFound, unauthorized } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';
import { buildPublicMediaUrl } from '@/server/storage';

type Params = { projectId: string };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILENAME_UNSAFE_CHARS = /[\\/:*?"<>|]+/g;

function sanitizeFilenamePart(value: string, fallback: string) {
  const cleaned = value
    .replace(FILENAME_UNSAFE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function firstPromptWords(project: { prompt: string | null; rawScript: string | null; title: string | null }) {
  const source = project.prompt?.trim() || project.rawScript?.trim() || project.title?.trim() || 'video';
  const words = source
    .replace(FILENAME_UNSAFE_CHARS, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
  return sanitizeFilenamePart(words, 'video');
}

function extensionFromVideoReference(reference: string | null | undefined) {
  if (!reference) return 'mp4';
  try {
    const url = /^https?:\/\//i.test(reference) ? new URL(reference) : null;
    const ext = path.extname(url?.pathname ?? reference).replace(/^\./, '').toLowerCase();
    return ext || 'mp4';
  } catch {
    const ext = path.extname(reference).replace(/^\./, '').toLowerCase();
    return ext || 'mp4';
  }
}

function contentDispositionFilename(filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function resolveFetchUrl(reference: string, request: NextRequest) {
  const absolute = /^https?:\/\//i.test(reference) ? reference : buildPublicMediaUrl(reference);
  return new URL(absolute, request.nextUrl.origin).toString();
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId } = await params;
  const language = req.nextUrl.searchParams.get('language')?.trim().toLowerCase() || null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId, deleted: false },
    select: {
      id: true,
      title: true,
      prompt: true,
      rawScript: true,
      finalVideoPath: true,
      finalVideoUrl: true,
      videos: {
        where: {
          isFinal: true,
          ...(language ? { languageCode: language } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { path: true, publicUrl: true },
      },
    },
  });
  if (!project) return notFound('Project not found');

  const video = project.videos[0] ?? null;
  const reference = video?.publicUrl || video?.path || project.finalVideoUrl || project.finalVideoPath || null;
  if (!reference) return notFound('Final video not found');

  const upstream = await fetch(resolveFetchUrl(reference, req), { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return error('VIDEO_DOWNLOAD_FAILED', 'Failed to fetch final video', 502);
  }

  const ext = extensionFromVideoReference(reference);
  const filename = `${firstPromptWords(project)} - yumcut.com - ${project.id}.${ext}`;
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  headers.set('Content-Disposition', contentDispositionFilename(filename));
  headers.set('Cache-Control', 'private, no-store');
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);

  return new Response(upstream.body, { status: 200, headers });
}, 'Failed to download project video');
