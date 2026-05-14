import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { ok, forbidden } from '@/server/http';
import { withApiError } from '@/server/errors';
import { jobTypeForStatus } from '@/shared/pipeline/job-types';
import { assertDaemonAuth } from '@/server/auth';
import { normalizeProjectExperience } from '@/shared/constants/project-experience';

type Params = { jobId: string };

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const daemonId = await assertDaemonAuth(req);
  if (!daemonId) return forbidden('Invalid daemon credentials');
  const { jobId } = await params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, type: true, status: true, projectId: true, project: { select: { status: true } } },
  });
  if (!job || job.status !== 'queued') return ok({ claimed: false });
  const initialJob = await prisma.job.findFirst({
    where: { projectId: job.projectId },
    orderBy: { createdAt: 'asc' },
    select: { payload: true },
  });
  const projectExperience = normalizeProjectExperience((initialJob?.payload as any)?.projectExperience);
  const expected = jobTypeForStatus(job.project.status as any, projectExperience);
  if (expected && expected !== job.type) {
    return ok({ claimed: false });
  }
  if (!expected) return ok({ claimed: false });
  const now = new Date();
  const claimed = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.job.updateMany({
      where: {
        id: jobId,
        status: 'queued',
        projectId: job.projectId,
        project: {
          AND: [
            {
              OR: [
                { currentDaemonId: daemonId },
                { currentDaemonId: null },
              ],
            },
            { deleted: false },
            { jobs: { none: { status: 'running' } } },
          ],
        },
      },
      data: { status: 'running', daemonId },
    });
    if (updateResult.count === 0) {
      return false;
    }
    await tx.project.update({
      where: { id: job.projectId },
      data: {
        currentDaemonId: daemonId,
        currentDaemonLockedAt: now,
      },
    });
    return true;
  });
  return ok({ claimed });
}, 'Failed to claim job');
