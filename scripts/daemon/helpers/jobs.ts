import { ProjectStatus } from '@/shared/constants/status';
import { jobTypeForStatus } from '@/shared/pipeline/job-types';
import { ProjectRow, createJob, jobExistsFor, findQueuedJobs, claimJob, JobRow } from './db';
import { log } from './logger';
import { isVerboseScheduler } from './scheduler-flags';

// Ensure there is a queued job for each eligible project (no-op if one already exists)
export async function ensureJobsForProjects(projects: ProjectRow[]) {
  for (const p of projects) {
    const type = jobTypeForStatus(p.status, p.projectExperience);
    if (!type) continue;
    if (p.status === ProjectStatus.ProcessTranscription) {
      log.info('Scheduler skipping auto job creation for per-language status', { projectId: p.id, status: p.status });
      continue;
    }
    if (isVerboseScheduler()) {
      log.info('Scheduler ensure-job', { projectId: p.id, status: p.status, expectedType: type });
    }
    const exists = await jobExistsFor(p.id, type);
    if (!exists) {
      try {
        await createJob(p.id, p.userId, type);
        log.info('Scheduler created job', { projectId: p.id, type });
      } catch (err: any) {
        log.error('Scheduler failed to create job', { projectId: p.id, type, error: err?.message || String(err) });
      }
    } else {
      if (isVerboseScheduler()) {
        log.info('Scheduler job already exists', { projectId: p.id, type });
      }
    }
  }
}

export async function claimNextJobs(limit: number) {
  const candidates = await findQueuedJobs(limit);
  const dedupedCandidates = Array.from(
    new Map(candidates.map((job) => [job.id, job])).values(),
  );
  if (isVerboseScheduler()) {
    log.info('Scheduler queued jobs fetched', {
      count: candidates.length,
      dedupedCount: dedupedCandidates.length,
    });
  }
  const claimed: JobRow[] = [];
  for (const j of dedupedCandidates) {
    const ok = await claimJob(j.id);
    if (ok || isVerboseScheduler()) {
      log.info('Scheduler claim attempt', { jobId: j.id, projectId: j.projectId, type: j.type, ok });
    }
    if (ok) claimed.push(j);
    if (claimed.length >= limit) break;
  }
  return claimed;
}
