import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { ok, forbidden } from '@/server/http';
import { withApiError } from '@/server/errors';
import { assertDaemonAuth } from '@/server/auth';
import { daemonClaimJobsSchema } from '@/server/validators/daemon';
import { jobTypeForStatus, legalStatusTypePairs } from '@/shared/pipeline/job-types';
import { normalizeProjectExperience, type ProjectExperience } from '@/shared/constants/project-experience';

export const GET = withApiError(async function GET(req: NextRequest) {
  const daemonId = await assertDaemonAuth(req);
  if (!daemonId) return forbidden('Invalid daemon credentials');
  const parsed = daemonClaimJobsSchema.safeParse({ limit: req.nextUrl.searchParams.get('limit') });
  const limit = parsed.success ? parsed.data.limit : 10;

  const pairs = legalStatusTypePairs();
  const rows = await prisma.job.findMany({
    where: {
      status: 'queued',
      OR: pairs.map((p) => ({ type: p.type, project: { status: p.status } })),
      project: {
        AND: [
          { deleted: false },
          { jobs: { none: { status: 'running' } } },
          {
            OR: [
              { currentDaemonId: daemonId },
              { currentDaemonId: null },
            ],
          },
        ],
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit * 5,
    select: {
      id: true,
      projectId: true,
      type: true,
      status: true,
      createdAt: true,
      payload: true,
      project: { select: { status: true } },
    },
  });
  const filteredRows = [];
  const experienceCache = new Map<string, ProjectExperience>();
  for (const row of rows) {
    let projectExperience = experienceCache.get(row.projectId);
    if (!projectExperience) {
      projectExperience = await projectExperienceForProject(row.projectId);
      experienceCache.set(row.projectId, projectExperience);
    }
    const expected = jobTypeForStatus(row.project.status as any, projectExperience);
    if (expected && expected === row.type) {
      filteredRows.push(row);
    }
    if (filteredRows.length >= limit) break;
  }

  return ok({
    jobs: filteredRows.map((job) => ({
      id: job.id,
      projectId: job.projectId,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      payload: job.payload,
    })),
  });
}, 'Failed to load queued jobs');

async function projectExperienceForProject(projectId: string): Promise<ProjectExperience> {
  const initialJob = await prisma.job.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: { payload: true },
  });
  return normalizeProjectExperience((initialJob?.payload as any)?.projectExperience);
}
