import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { ok, unauthorized, notFound } from '@/server/http';
import { withApiError } from '@/server/errors';
import { ProjectStatus } from '@/shared/constants/status';
import { authenticateApiRequest } from '@/server/api-user';

type Params = { projectId: string };

export const POST = withApiError(async function POST(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await authenticateApiRequest(_req);
  if (!auth) return unauthorized();
  const userId = auth.userId;
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, deleted: false } });
  if (!project) return notFound('Project not found');

  await prisma.$transaction([
    prisma.project.update({ where: { id: project.id }, data: { status: ProjectStatus.Cancelled } }),
    prisma.projectStatusHistory.create({ data: { projectId: project.id, status: ProjectStatus.Cancelled, message: 'User cancelled' } }),
  ]);

  return ok({ ok: true });
}, 'Failed to cancel project');
