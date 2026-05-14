import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { ProjectStatus } from '@/shared/constants/status';

const generateCaptionsOverlayMock = vi.hoisted(() => vi.fn());
const ensureProjectScaffoldMock = vi.hoisted(() => vi.fn());
const ensureLanguageWorkspaceMock = vi.hoisted(() => vi.fn());
const ensureLanguageLogDirMock = vi.hoisted(() => vi.fn());
const getLanguageProgressMock = vi.hoisted(() => vi.fn());
const setStatusMock = vi.hoisted(() => vi.fn());
const updateLanguageProgressMock = vi.hoisted(() => vi.fn());
const markLanguageFailureMock = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/captions', () => ({
  generateCaptionsOverlay: generateCaptionsOverlayMock,
}));

vi.mock('../../scripts/daemon/helpers/language-workspace', () => ({
  ensureProjectScaffold: ensureProjectScaffoldMock,
  ensureLanguageWorkspace: ensureLanguageWorkspaceMock,
  ensureLanguageLogDir: ensureLanguageLogDirMock,
}));

vi.mock('../../scripts/daemon/helpers/db', () => ({
  getLanguageProgress: getLanguageProgressMock,
  setStatus: setStatusMock,
  updateLanguageProgress: updateLanguageProgressMock,
  markLanguageFailure: markLanguageFailureMock,
}));

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleCaptionsPhase } from '../../scripts/daemon/helpers/executor/captions-phase';

describe('captions phase routing', () => {
  let baseDir: string;
  let workspaceRoot: string;
  let logsRoot: string;
  let progressRow: any;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(tmpdir(), 'captions-phase-routing-'));
    workspaceRoot = path.join(baseDir, 'workspace');
    logsRoot = path.join(baseDir, 'logs');
    progressRow = {
      languageCode: 'en',
      transcriptionDone: true,
      captionsDone: false,
      videoPartsDone: false,
      finalVideoDone: false,
      disabled: false,
      failedStep: null,
      failureReason: null,
    };
    vi.clearAllMocks();

    ensureProjectScaffoldMock.mockResolvedValue({ projectRoot: baseDir, workspaceRoot, logsRoot });
    ensureLanguageWorkspaceMock.mockImplementation(async (_projectId: string, languageCode: string) => {
      const languageWorkspace = path.join(workspaceRoot, languageCode);
      const languageLogsRoot = path.join(logsRoot, languageCode);
      await fs.mkdir(path.join(languageWorkspace, 'metadata'), { recursive: true });
      await fs.writeFile(path.join(languageWorkspace, 'metadata', 'transcript-blocks.json'), '{"blocks":[]}', 'utf8');
      await fs.mkdir(languageLogsRoot, { recursive: true });
      return { projectRoot: baseDir, workspaceRoot, logsRoot, languageCode, languageWorkspace, languageLogsRoot };
    });
    ensureLanguageLogDirMock.mockImplementation(async (info: { languageLogsRoot: string }, kind: string) => {
      const dir = path.join(info.languageLogsRoot, kind);
      await fs.mkdir(dir, { recursive: true });
      return dir;
    });
    getLanguageProgressMock.mockImplementation(async () => ({
      progress: [progressRow],
      aggregate: {
        transcription: { done: true, remaining: [] },
        captions: { done: progressRow.captionsDone, remaining: progressRow.captionsDone ? [] : ['en'] },
        videoParts: { done: false, remaining: ['en'] },
        finalVideo: { done: false, remaining: ['en'] },
      },
    }));
    updateLanguageProgressMock.mockImplementation(async (_projectId: string, update: any) => {
      progressRow = { ...progressRow, ...update };
    });
    generateCaptionsOverlayMock.mockResolvedValue({ logPath: path.join(logsRoot, 'captions.log'), command: 'captions' });
    setStatusMock.mockResolvedValue(undefined);
    markLanguageFailureMock.mockResolvedValue(undefined);
  });

  it('routes completed character captions to video parts', async () => {
    await handleCaptionsPhase({
      projectId: 'project-character',
      cfg: { targetLanguage: 'en', languages: ['en'], projectExperience: 'character', template: null } as any,
      daemonConfig: { scriptCaptionWorkspace: baseDir, captionsRenderer: 'dummy' } as any,
    });

    expect(setStatusMock).toHaveBeenLastCalledWith(
      'project-character',
      ProjectStatus.ProcessVideoPartsGeneration,
      'Captions overlay generated',
      expect.any(Object),
    );
  });

  it('routes completed story captions to images', async () => {
    await handleCaptionsPhase({
      projectId: 'project-story',
      cfg: { targetLanguage: 'en', languages: ['en'], projectExperience: 'story', template: null } as any,
      daemonConfig: { scriptCaptionWorkspace: baseDir, captionsRenderer: 'dummy' } as any,
    });

    expect(setStatusMock).toHaveBeenLastCalledWith(
      'project-story',
      ProjectStatus.ProcessImagesGeneration,
      'Captions overlay generated',
      expect.any(Object),
    );
  });
});
