import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { forbidden, ok, error } from '@/server/http';
import { ProjectStatus } from '@/shared/constants/status';
import { verifySignedJsonPayload } from '@/lib/upload-signature';

const callbackSchema = z.object({
  version: z.number().optional(),
  projectId: z.string().min(1),
  requestId: z.string().optional(),
  event: z.enum(['success', 'error']).optional(),
  ok: z.boolean().optional(),
  mode: z.string().optional(),
  error: z.string().optional(),
  artifacts: z.record(z.string(), z.any()).optional(),
  timing: z.any().optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiError(async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    return error('VALIDATION_ERROR', 'Invalid callback payload', 400);
  }
  const data = (json as any).data;
  const signature = (json as any).signature;
  if (typeof data !== 'string' || typeof signature !== 'string') {
    return forbidden('Missing signed callback payload');
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = verifySignedJsonPayload(data, signature);
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Invalid callback signature';
    return forbidden(message);
  }

  const parsed = callbackSchema.safeParse(parsedPayload);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid signed callback payload', 400, parsed.error.flatten());
  }

  const payload = parsed.data;
  const project = await prisma.project.findFirst({ where: { id: payload.projectId, deleted: false } });
  if (!project) {
    return ok({ stored: false, reason: 'project_not_found' });
  }

  const success = payload.ok === true || payload.event === 'success';
  const status = success ? ProjectStatus.Done : ProjectStatus.Error;
  const message = success ? 'Rigger animation completed' : (payload.error || 'Rigger animation failed');
  const artifacts = normalizeArtifactRows(payload.artifacts);

  await prisma.$transaction([
    ...artifacts.map((artifact) => (prisma as any).projectArtifact.create({
      data: {
        projectId: project.id,
        kind: artifact.kind,
        variant: artifact.variant,
        path: artifact.path,
        publicUrl: artifact.url,
        metadata: artifact.metadata,
      },
    })),
    prisma.projectStatusHistory.create({
      data: {
        projectId: project.id,
        status,
        message,
        extra: {
          source: 'rigger-animation',
          requestId: payload.requestId ?? null,
          mode: payload.mode ?? null,
          artifacts: payload.artifacts ?? {},
          timing: payload.timing ?? null,
          error: payload.error ?? null,
        },
      },
    }),
    prisma.project.update({
      where: { id: project.id },
      data: {
        status,
        ...(success ? finalVideoUpdate(artifacts) : {}),
      } as any,
    }),
  ]);

  return ok({ stored: true, status, artifacts: artifacts.length });
}, 'Failed to store rigger animation callback');

function normalizeArtifactRows(artifacts: Record<string, any> | undefined) {
  if (!artifacts) return [];
  return Object.entries(artifacts)
    .map(([name, value]) => {
      const upload = value?.upload ?? value;
      const path = upload?.path ?? value?.path;
      const url = upload?.url ?? upload?.publicUrl ?? value?.url;
      if (typeof path !== 'string' || path.length === 0) return null;
      return {
        kind: String(value?.kind ?? upload?.kind ?? name),
        variant: value?.variant ? String(value.variant) : null,
        path,
        url: typeof url === 'string' ? url : null,
        metadata: { name },
      };
    })
    .filter(Boolean) as Array<{ kind: string; variant: string | null; path: string; url: string | null; metadata: Record<string, unknown> }>;
}

function finalVideoUpdate(artifacts: Array<{ variant: string | null; path: string; url: string | null }>) {
  const final = artifacts.find((artifact) => artifact.variant === 'final' || artifact.variant === 'mp4')
    ?? artifacts.find((artifact) => artifact.variant === 'transparent');
  if (!final) return {};
  return {
    finalVideoPath: final.path,
    finalVideoUrl: final.url,
  };
}
