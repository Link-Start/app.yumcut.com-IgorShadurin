import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import path from 'path';
import { mkdir, rm, readdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { startFakeApiServer, startFakeStorageServer, type ApiServer, type StorageServer } from './helpers/fake-servers';
import { makeEnvFile, startDaemon, type DaemonProcess } from './helpers/daemon';
import { buildDaemonEnvContent } from './helpers/env';

async function waitFor<T>(predicate: () => T | Promise<T>, timeoutMs = 8000, intervalMs = 50): Promise<NonNullable<T>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) return result as NonNullable<T>;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('waitFor timeout');
}

async function readVoiceSidecar(workspaceRoot: string, projectId: string, languageCode: string): Promise<string> {
  const audioRoot = path.join(workspaceRoot, projectId, 'workspace', languageCode, 'audio');
  const runDir = await waitFor(async () => {
    try {
      const runs = await readdir(audioRoot);
      const valid = runs.filter((name) => !name.startsWith('.'));
      if (valid.length === 0) return null;
      // Latest directory should contain the generated take
      return path.join(audioRoot, valid.sort().pop()!);
    } catch {
      return null;
    }
  });
  const takeFile = await waitFor(async () => {
    try {
      const files = await readdir(runDir);
      const match = files.find((name) => name.startsWith('take-') && name.endsWith('.wav.txt'));
      return match ? path.join(runDir, match) : null;
    } catch {
      return null;
    }
  });
  return readFile(takeFile, 'utf8');
}

async function readVoiceLabel(workspaceRoot: string, projectId: string, languageCode: string): Promise<string> {
  const content = await readVoiceSidecar(workspaceRoot, projectId, languageCode);
  const firstLine = content.split('\n', 1)[0] ?? '';
  return firstLine.replace(/^Generated for:\s*/, '').trim();
}

describe('daemon voice assignments', () => {
  let api: ApiServer;
  let storage: StorageServer;
  let daemon: DaemonProcess | null = null;
  let workspaceRoot: string;
  let envFilePath: string;
  let cloneFallbackRoot: string;

  beforeEach(async () => {
    api = await startFakeApiServer({ password: 'secret' });
    storage = await startFakeStorageServer();
    const wsName = `workspace-${randomUUID()}`;
    workspaceRoot = path.resolve('tests/daemon/workspaces', wsName);
    cloneFallbackRoot = path.join(workspaceRoot, '.voice-clones');
    await mkdir(workspaceRoot, { recursive: true });

    const envContent = buildDaemonEnvContent({
      apiBaseUrl: api.baseUrl,
      storageBaseUrl: storage.baseUrl,
      password: 'secret',
      projectsWorkspace: workspaceRoot,
      overrides: {
        taskTimeoutSeconds: 12,
        requestTimeoutMs: 500,
        audioDefaultVoice: 'DefaultVoice',
        voiceCloneFallbackDir: cloneFallbackRoot,
        logsSilent: '0',
      },
    });
    envFilePath = makeEnvFile(path.join(workspaceRoot, '.tmp'), envContent);
  });

  afterEach(async () => {
    try { if (daemon) await daemon.stop(); } catch {}
    try { await api.close(); } catch {}
    try { await storage.close(); } catch {}
    try { await rm(workspaceRoot, { recursive: true, force: true }); } catch {}
  });

  it('uses fallback voices from the mapping when project voice is not compatible', async () => {
    const projectId = `p_${randomUUID()}`;
    const projectVoice = 'english-primary-voice';
    const fallbackVoice = 'french-fast-fallback';

    api.state.projects.push({
      id: projectId,
      status: 'ProcessAudio',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    api.state.jobs.push({
      id: `job_${Date.now()}`,
      projectId,
      type: 'audio',
      status: 'queued',
      createdAt: new Date().toISOString(),
      payload: {},
    });
    api.state.scripts[projectId] = 'Script for voice assignment verification.';

    api.set('GET /api/daemon/projects/:id/creation-snapshot', async (_req, res) => {
      const payload = {
        userId: 'user-1',
        autoApproveScript: true,
        autoApproveAudio: false,
        includeDefaultMusic: true,
        addOverlay: false,
        includeCallToAction: false,
        watermarkEnabled: false,
        captionsEnabled: false,
        useExactTextAsScript: true,
        durationSeconds: 8,
        targetLanguage: 'en',
        languages: ['en', 'fr'],
        scriptCreationGuidanceEnabled: false,
        scriptCreationGuidance: '',
        scriptAvoidanceGuidanceEnabled: false,
        scriptAvoidanceGuidance: '',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        voiceId: projectVoice,
        voiceAssignments: {
          en: {
            voiceId: projectVoice,
            templateVoiceId: 'tpl-en',
            title: 'English Primary',
            speed: 'fast',
            gender: 'female',
            voiceProvider: 'minimax',
            source: 'project',
          },
          fr: {
            voiceId: fallbackVoice,
            templateVoiceId: 'tpl-fr',
            title: 'French Fast',
            speed: 'fast',
            gender: 'female',
            voiceProvider: 'minimax',
            source: 'fallback',
          },
        },
        voiceProviders: {
          [projectVoice]: 'minimax',
          [fallbackVoice]: 'minimax',
        },
        characterSelection: null,
        template: null,
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    });

    daemon = startDaemon(envFilePath, { YUMCUT_DUMMY_RUN_ID: 'VOICE_MAP' });

    const englishLabel = await readVoiceLabel(workspaceRoot, projectId, 'en');
    const frenchLabel = await readVoiceLabel(workspaceRoot, projectId, 'fr');

    expect(englishLabel).toBe(projectVoice);
    expect(frenchLabel).toBe(fallbackVoice);
    expect(frenchLabel).not.toBe('DefaultVoice');
  }, 20000);

  it('uses a cloned fallback voice before provider TTS when the cloned sample exists', async () => {
    const projectId = `p_${randomUUID()}`;
    const clonedVoice = 'English_CalmWoman';
    const providerVoice = 'French_CasualMan';
    const clonePath = path.join(cloneFallbackRoot, 'minimax', 'english', `${clonedVoice}.mp3`);
    await mkdir(path.dirname(clonePath), { recursive: true });
    await writeFile(clonePath, 'fake cloned voice');

    api.state.projects.push({
      id: projectId,
      status: 'ProcessAudio',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    api.state.jobs.push({
      id: `job_${Date.now()}`,
      projectId,
      type: 'audio',
      status: 'queued',
      createdAt: new Date().toISOString(),
      payload: {},
    });
    api.state.scripts[projectId] = 'Script for cloned voice routing verification.';

    api.set('GET /api/daemon/projects/:id/creation-snapshot', async (_req, res) => {
      const payload = {
        userId: 'user-1',
        autoApproveScript: true,
        autoApproveAudio: false,
        includeDefaultMusic: true,
        addOverlay: false,
        includeCallToAction: false,
        watermarkEnabled: false,
        captionsEnabled: false,
        useExactTextAsScript: true,
        durationSeconds: 8,
        targetLanguage: 'en',
        languages: ['en', 'fr'],
        scriptCreationGuidanceEnabled: false,
        scriptCreationGuidance: '',
        scriptAvoidanceGuidanceEnabled: false,
        scriptAvoidanceGuidance: '',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        voiceId: clonedVoice,
        voiceAssignments: {
          en: {
            voiceId: clonedVoice,
            templateVoiceId: 'tpl-en',
            title: 'English Clone',
            speed: 'fast',
            gender: 'female',
            voiceProvider: 'minimax',
            source: 'project',
          },
          fr: {
            voiceId: providerVoice,
            templateVoiceId: 'tpl-fr',
            title: 'French Provider',
            speed: 'fast',
            gender: 'male',
            voiceProvider: 'minimax',
            source: 'project',
          },
        },
        voiceProviders: {
          [clonedVoice]: 'minimax',
          [providerVoice]: 'minimax',
        },
        characterSelection: null,
        template: null,
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    });

    daemon = startDaemon(envFilePath, { YUMCUT_DUMMY_RUN_ID: 'VOICE_CLONE_FALLBACK' });

    const englishSidecar = await readVoiceSidecar(workspaceRoot, projectId, 'en');
    const frenchSidecar = await readVoiceSidecar(workspaceRoot, projectId, 'fr');

    expect(englishSidecar).toContain(`Generated for: ${clonedVoice}`);
    expect(englishSidecar).toContain('Provider: runpod-clone');
    expect(englishSidecar).toContain(`Clone source: ${clonePath}`);
    expect(frenchSidecar).toContain(`Generated for: ${providerVoice}`);
    expect(frenchSidecar).toContain('Provider: minimax');
    expect(frenchSidecar).not.toContain('Clone source:');
  }, 20000);
});
