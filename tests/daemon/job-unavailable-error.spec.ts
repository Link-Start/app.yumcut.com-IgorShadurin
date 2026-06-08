import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { buildDaemonEnvContent } from './helpers/env';

describe('isJobUnavailableError', () => {
  let tmpRoot: string;
  let isJobUnavailableError: typeof import('../../scripts/daemon/helpers/db').isJobUnavailableError;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daemon-job-unavailable-'));
    const projectsWorkspace = path.join(tmpRoot, 'projects');
    await fs.mkdir(projectsWorkspace, { recursive: true });
    const envPath = path.join(tmpRoot, '.daemon.env');
    await fs.writeFile(envPath, buildDaemonEnvContent({
      apiBaseUrl: 'http://127.0.0.1:4010',
      storageBaseUrl: 'http://127.0.0.1:5010',
      password: 'secret',
      projectsWorkspace,
    }), 'utf8');
    process.env.DAEMON_ENV_FILE = envPath;
    ({ isJobUnavailableError } = await import('../../scripts/daemon/helpers/db'));
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('matches prisma P2025 update-not-found errors', () => {
    const error = new Error('Failed to update job status: The requested record was not found. code=P2025');
    expect(isJobUnavailableError(error)).toBe(true);
  });

  it('matches low-level update missing record text', () => {
    const error = new Error('No record was found for an update.');
    expect(isJobUnavailableError(error)).toBe(true);
  });

  it('does not match unrelated errors', () => {
    const error = new Error('OpenRouterProvider error 401: User not found.');
    expect(isJobUnavailableError(error)).toBe(false);
  });
});
