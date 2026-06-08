import { beforeEach, describe, expect, it, vi } from 'vitest';

const findQueuedJobs = vi.hoisted(() => vi.fn());
const claimJob = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/db', () => ({
  findQueuedJobs,
  claimJob,
  createJob: vi.fn(),
  jobExistsFor: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../scripts/daemon/helpers/scheduler-flags', () => ({
  isVerboseScheduler: () => false,
}));

describe('daemon jobs claim dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims duplicated queued jobs only once per job id', async () => {
    findQueuedJobs.mockResolvedValue([
      { id: 'job-1', projectId: 'project-1', type: 'script', payload: null },
      { id: 'job-1', projectId: 'project-1', type: 'script', payload: null },
      { id: 'job-2', projectId: 'project-2', type: 'audio', payload: null },
    ]);
    claimJob.mockImplementation(async (jobId: string) => jobId !== 'job-2');

    const { claimNextJobs } = await import('../../scripts/daemon/helpers/jobs');
    const claimed = await claimNextJobs(5);

    expect(claimJob).toHaveBeenCalledTimes(2);
    expect(claimJob).toHaveBeenNthCalledWith(1, 'job-1');
    expect(claimJob).toHaveBeenNthCalledWith(2, 'job-2');
    expect(claimed).toEqual([
      { id: 'job-1', projectId: 'project-1', type: 'script', payload: null },
    ]);
  });
});

