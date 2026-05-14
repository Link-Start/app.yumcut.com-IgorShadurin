import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  formatExternalToolsDoctorReport,
  hasBlockingExternalToolIssues,
  runExternalToolsDoctor,
} from '../../scripts/daemon/helpers/external-tools-doctor';

describe('external tools doctor', () => {
  let tmpRoot: string | null = null;

  afterEach(async () => {
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
    }
  });

  it('reports missing external tool env files without leaking secrets', async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'daemon-doctor-missing-'));
    const scriptWorkspace = path.join(tmpRoot, 'ai-agent');
    const v2Workspace = path.join(tmpRoot, 'shorts');
    const charactersWorkspace = path.join(tmpRoot, 'characters');
    const captionWorkspace = path.join(tmpRoot, 'caption');
    await Promise.all([
      mkdir(scriptWorkspace),
      mkdir(v2Workspace),
      mkdir(charactersWorkspace),
      mkdir(captionWorkspace),
    ]);
    const envFile = path.join(tmpRoot, '.daemon.env');
    await writeFile(envFile, [
      `DAEMON_SCRIPT_WORKSPACE=${scriptWorkspace}`,
      `DAEMON_SCRIPT_WORKSPACE_V2=${v2Workspace}`,
      `DAEMON_CHARACTERS_WORKSPACE=${charactersWorkspace}`,
      `DAEMON_SCRIPT_CAPTION=${captionWorkspace}`,
    ].join('\n'));

    const report = await runExternalToolsDoctor({ cwd: tmpRoot, envFile, network: false });

    expect(hasBlockingExternalToolIssues(report)).toBe(true);
    expect(report.checks.every((check) => check.status === 'missing')).toBe(true);
    expect(formatExternalToolsDoctorReport(report)).toContain('Missing external tool .env');
  });

  it('marks OpenRouter 401 responses invalid and masks configured keys', async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'daemon-doctor-invalid-'));
    const scriptWorkspace = path.join(tmpRoot, 'ai-agent');
    const v2Workspace = path.join(tmpRoot, 'shorts');
    const charactersWorkspace = path.join(tmpRoot, 'characters');
    const captionWorkspace = path.join(tmpRoot, 'caption');
    await Promise.all([
      mkdir(scriptWorkspace),
      mkdir(v2Workspace),
      mkdir(charactersWorkspace),
      mkdir(captionWorkspace),
    ]);
    await writeFile(path.join(scriptWorkspace, '.env'), 'LLM_API_KEY=sk-or-invalid-1234567890\n');
    await writeFile(path.join(v2Workspace, '.env'), [
      'OPENROUTER_API_KEY=sk-or-valid-abcdefgh',
      'RUNWARE_API_KEY=runware-secret-value',
      'RUNPOD_API_KEY=runpod-secret-value',
      'GEMINI_API_KEYS=gemini-secret-value',
      'MINIMAX_API_KEY=minimax-secret-value',
      'INWORLD_API_KEY_BASIC=inworld-secret-value',
      'ELEVENLABS_API=eleven-secret-value',
    ].join('\n'));
    await writeFile(path.join(charactersWorkspace, '.env'), 'RUNWARE_API_KEY=character-runware-secret\n');
    await writeFile(path.join(captionWorkspace, '.env'), 'GEMINI_API_KEY=caption-gemini-secret\n');
    const envFile = path.join(tmpRoot, '.daemon.env');
    await writeFile(envFile, [
      `DAEMON_SCRIPT_WORKSPACE=${scriptWorkspace}`,
      `DAEMON_SCRIPT_WORKSPACE_V2=${v2Workspace}`,
      `DAEMON_CHARACTERS_WORKSPACE=${charactersWorkspace}`,
      `DAEMON_SCRIPT_CAPTION=${captionWorkspace}`,
    ].join('\n'));
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"User not found"}}', { status: 401 })) as any;

    const report = await runExternalToolsDoctor({ cwd: tmpRoot, envFile, fetchImpl });
    const text = formatExternalToolsDoctorReport(report);

    expect(hasBlockingExternalToolIssues(report)).toBe(true);
    expect(report.checks.some((check) => check.key === 'LLM_API_KEY' && check.status === 'invalid')).toBe(true);
    expect(text).toContain('OpenRouter rejected the key with 401');
    expect(text).toContain('sk-o...7890');
    expect(text).not.toContain('sk-or-invalid-1234567890');
    expect(fetchImpl).toHaveBeenCalled();
  });
});
