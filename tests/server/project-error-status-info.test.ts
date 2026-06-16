import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProjectErrorStatusInfo, getProjectErrorLogFileForAdmin } from '@/server/projects/errors';

describe('buildProjectErrorStatusInfo', () => {
  it('keeps public error status limited to the display message by default', () => {
    const info = buildProjectErrorStatusInfo({
      message: 'Video parts rendering failed',
      extra: {
        phase: 'video_parts',
        error: 'Command failed with code 1',
        command: 'npm run render',
      },
      createdAt: new Date('2026-06-16T05:42:43.565Z'),
    });

    expect(info).toEqual({ message: 'Video parts rendering failed' });
  });

  it('builds admin diagnostics from status history extra', () => {
    const info = buildProjectErrorStatusInfo({
      message: 'Script phase failed',
      extra: {
        phase: 'script',
        languageCode: 'ru',
        meta: {
          reason: null,
          error: 'Command failed with code 1',
        },
      },
      createdAt: new Date('2026-06-16T05:42:43.565Z'),
    }, null, { includeExtra: true });

    expect(info.message).toBe('Script phase failed');
    expect(info.occurredAt).toBe('2026-06-16T05:42:43.565Z');
    expect(info.errorDetails).toEqual([
      { label: 'Phase', value: 'script' },
      { label: 'Language', value: 'ru' },
      { label: 'Error', value: 'Command failed with code 1' },
    ]);
    expect(info.errorExtra).toEqual({
      phase: 'script',
      languageCode: 'ru',
      meta: {
        reason: null,
        error: 'Command failed with code 1',
      },
    });
  });

  it('reads an existing status log path for admin diagnostics', async () => {
    const projectId = 'fc6520d9-3b2d-4112-87d8-2650e0023bbd';
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-error-log-'));
    const logDir = path.join(root, projectId, 'logs');
    const logPath = path.join(logDir, 'script.log');
    const content = 'Command: npm run template:launch\n[STDERR] OpenRouter: empty response\n';
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(logPath, content, 'utf8');

    const logFile = await getProjectErrorLogFileForAdmin(projectId, { logPath }, { projectsWorkspace: null });

    expect(logFile).toMatchObject({
      path: logPath,
      content,
      sizeBytes: Buffer.byteLength(content),
      truncated: false,
      source: 'status-log-path',
    });
  });

  it('discovers the newest template launch log when status extra has no path', async () => {
    const projectId = 'fc6520d9-3b2d-4112-87d8-2650e0023bbd';
    const projectsWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'project-template-log-'));
    const logDir = path.join(projectsWorkspace, projectId, 'workspace', 'template', 'v2-crime-slavic', 'logs');
    const oldLog = path.join(logDir, 'template-launch-2026-06-16T07-00-00.000Z.log');
    const newLog = path.join(logDir, 'template-launch-2026-06-16T07-27-55.232Z.log');
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(oldLog, 'old log\n', 'utf8');
    await fs.writeFile(newLog, 'new log\nExecutionError: Stage text-script failed\n', 'utf8');
    const oldDate = new Date('2026-06-16T07:00:00.000Z');
    const newDate = new Date('2026-06-16T07:30:25.000Z');
    await fs.utimes(oldLog, oldDate, oldDate);
    await fs.utimes(newLog, newDate, newDate);

    const logFile = await getProjectErrorLogFileForAdmin(projectId, null, { projectsWorkspace });

    expect(logFile).toMatchObject({
      path: newLog,
      content: 'new log\nExecutionError: Stage text-script failed\n',
      truncated: false,
      source: 'template-launch',
    });
  });
});
