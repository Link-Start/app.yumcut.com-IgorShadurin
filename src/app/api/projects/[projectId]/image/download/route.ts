import { NextRequest } from 'next/server';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, notFound, unauthorized } from '@/server/http';
import { authenticateApiRequest } from '@/server/api-user';
import { buildPublicMediaUrl, toStoredMediaPath } from '@/server/storage';
import { issueSignedMediaDownloadGrant } from '@/lib/upload-signature';

type Params = { projectId: string };
type DownloadFormat = 'original' | 'png' | 'jpg' | 'webp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED_FORMATS = new Set<DownloadFormat>(['original', 'png', 'jpg', 'webp']);

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

function contentDispositionFilename(filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function extensionFromReference(reference: string | null | undefined, contentType: string | null | undefined) {
  const lowerType = (contentType || '').toLowerCase();
  if (lowerType.includes('png')) return 'png';
  if (lowerType.includes('webp')) return 'webp';
  if (lowerType.includes('jpeg') || lowerType.includes('jpg')) return 'jpg';
  if (reference) {
    try {
      const pathname = /^https?:\/\//i.test(reference) ? new URL(reference).pathname : reference;
      const ext = path.extname(pathname.split('?')[0] || '').replace(/^\./, '').toLowerCase();
      if (ext === 'jpeg') return 'jpg';
      if (ext) return ext;
    } catch {
      const ext = path.extname(reference.split('?')[0] || '').replace(/^\./, '').toLowerCase();
      if (ext === 'jpeg') return 'jpg';
      if (ext) return ext;
    }
  }
  return 'jpg';
}

function buildDirectFetchUrl(reference: string, request: NextRequest) {
  const absolute = /^https?:\/\//i.test(reference) ? reference : buildPublicMediaUrl(reference);
  return new URL(absolute, request.nextUrl.origin).toString();
}

function buildSignedFetchUrl(reference: string, userId: string, request: NextRequest) {
  const normalizedPath = toStoredMediaPath(reference);
  const grant = issueSignedMediaDownloadGrant({
    path: normalizedPath,
    userId,
    disposition: 'inline',
    ttlMs: 60_000,
  });
  const url = buildDirectFetchUrl(normalizedPath, request);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}data=${encodeURIComponent(grant.data)}&sig=${encodeURIComponent(grant.signature)}`;
}

async function fetchImage(reference: string, userId: string, request: NextRequest) {
  const candidates: string[] = [];
  try {
    candidates.push(buildSignedFetchUrl(reference, userId, request));
  } catch {
    // Public/static media is still fetchable server-side in local and CDN-backed deployments.
  }
  candidates.push(buildDirectFetchUrl(reference, request));

  let lastStatus = 0;
  for (const url of candidates) {
    const upstream = await fetch(url, { cache: 'no-store' });
    lastStatus = upstream.status;
    if (upstream.ok) return upstream;
  }
  throw new Error(`Failed to fetch final image (${lastStatus || 'no response'})`);
}

async function convertImage(buffer: Buffer, format: Exclude<DownloadFormat, 'original'>) {
  const base = sharp(buffer, { failOn: 'none' }).rotate();
  if (format === 'png') {
    return { buffer: await base.png().toBuffer(), contentType: 'image/png', ext: 'png' };
  }
  if (format === 'webp') {
    return { buffer: await base.webp({ quality: 98 }).toBuffer(), contentType: 'image/webp', ext: 'webp' };
  }
  return {
    buffer: await base.flatten({ background: '#ffffff' }).jpeg({ quality: 95, mozjpeg: true }).toBuffer(),
    contentType: 'image/jpeg',
    ext: 'jpg',
  };
}

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const { projectId } = await params;
  const rawFormat = req.nextUrl.searchParams.get('format')?.trim().toLowerCase() || 'original';
  const format = (SUPPORTED_FORMATS.has(rawFormat as DownloadFormat) ? rawFormat : 'original') as DownloadFormat;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: auth.userId, deleted: false },
    select: {
      id: true,
      title: true,
      prompt: true,
      images: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { path: true, publicUrl: true },
      },
      jobs: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { payload: true },
      },
      statusLog: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { extra: true },
      },
    },
  });
  if (!project) return notFound('Project not found');

  const latestExtra = (project.statusLog[0]?.extra as Record<string, unknown> | null | undefined) ?? {};
  const initialPayload = (project.jobs[0]?.payload as Record<string, unknown> | null | undefined) ?? {};
  const imageAsset = project.images[0] ?? null;
  const reference =
    pickString(latestExtra.finalImagePath)
    || pickString(imageAsset?.path)
    || pickString(latestExtra.finalImageUrl)
    || pickString(imageAsset?.publicUrl);
  if (!reference) return notFound('Final image not found');

  let upstream: Response;
  try {
    upstream = await fetchImage(reference, auth.userId, req);
  } catch (fetchErr: any) {
    return error('IMAGE_DOWNLOAD_FAILED', fetchErr?.message || 'Failed to fetch final image', 502);
  }

  const sourceBuffer = Buffer.from(await upstream.arrayBuffer());
  const sourceContentType = upstream.headers.get('content-type') || 'image/jpeg';
  const prompt = pickString(latestExtra.userPrompt) || pickString(initialPayload.userPrompt) || project.prompt || project.title;
  const baseFilename = buildDownloadBaseFilename(prompt, project.id);

  const prepared = format === 'original'
    ? {
        buffer: sourceBuffer,
        contentType: sourceContentType,
        ext: extensionFromReference(reference, sourceContentType),
      }
    : await convertImage(sourceBuffer, format);

  const headers = new Headers();
  headers.set('Content-Type', prepared.contentType);
  headers.set('Content-Disposition', contentDispositionFilename(`${baseFilename}.${prepared.ext}`));
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Content-Length', String(prepared.buffer.byteLength));

  return new Response(new Uint8Array(prepared.buffer), { status: 200, headers });
}, 'Failed to download project image');
