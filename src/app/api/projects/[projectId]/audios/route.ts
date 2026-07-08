import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { ok, unauthorized, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { normalizeMediaUrl } from '@/server/storage';
import { authenticateApiRequest } from '@/server/api-user';

type Params = { projectId: string };

export const GET = withApiError(async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(_req);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return notFound('Project not found');

  const candidates = await prisma.audioCandidate.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' } });
  return ok({
    candidates: candidates.map((c) => ({
      id: c.id,
      path: c.publicUrl || normalizeMediaUrl(c.path),
    })),
  });
}, 'Failed to load audio candidates');
