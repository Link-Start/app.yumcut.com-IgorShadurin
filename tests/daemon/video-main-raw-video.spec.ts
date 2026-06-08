import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ProjectStatus } from '@/shared/constants/status';

const getLanguageProgressMock = vi.hoisted(() => vi.fn());
const getTranscriptionSnapshotMock = vi.hoisted(() => vi.fn());
const setStatusMock = vi.hoisted(() => vi.fn());
const setFinalVideoMock = vi.hoisted(() => vi.fn());
const setRawVideoMock = vi.hoisted(() => vi.fn());
const updateLanguageProgressMock = vi.hoisted(() => vi.fn());
const markLanguageFailureMock = vi.hoisted(() => vi.fn());
const buildFinalVideoMock = vi.hoisted(() => vi.fn());
const ensureProjectScaffoldMock = vi.hoisted(() => vi.fn());
const ensureLanguageWorkspaceMock = vi.hoisted(() => vi.fn());
const ensureLanguageLogDirMock = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../scripts/daemon/helpers/db', () => ({
  getLanguageProgress: getLanguageProgressMock,
  getTranscriptionSnapshot: getTranscriptionSnapshotMock,
  setStatus: setStatusMock,
  setFinalVideo: setFinalVideoMock,
  setRawVideo: setRawVideoMock,
  updateLanguageProgress: updateLanguageProgressMock,
  markLanguageFailure: markLanguageFailureMock,
}));

vi.mock('../../scripts/daemon/helpers/video', () => ({
  buildFinalVideo: buildFinalVideoMock,
}));

vi.mock('../../scripts/daemon/helpers/language-workspace', () => ({
  ensureProjectScaffold: ensureProjectScaffoldMock,
  ensureLanguageWorkspace: ensureLanguageWorkspaceMock,
  ensureLanguageLogDir: ensureLanguageLogDirMock,
}));

function progress(finalVideoDone: boolean) {
  return {
    progress: [
      {
        languageCode: 'en',
        disabled: false,
        transcriptionDone: true,
        captionsDone: true,
        videoPartsDone: true,
        finalVideoDone,
      },
    ],
    aggregate: {
      finalVideo: {
        done: finalVideoDone,
        remaining: finalVideoDone ? [] : ['en'],
      },
    },
  };
}

describe('video main raw video upload', () => {
  let tmpRoot: string;
  let workspaceRoot: string;
  let mainVideoPath: string;
  let finalVideoPath: string;
  let audioPath: string;
  let metadataPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daemon-video-main-raw-'));
    workspaceRoot = path.join(tmpRoot, 'workspace', 'en');
    mainVideoPath = path.join(workspaceRoot, 'video-basic-effects', 'final', 'simple.1080p.mp4');
    finalVideoPath = path.join(workspaceRoot, 'video-merge-layers', 'final.1080p.captions.mp4');
    audioPath = path.join(tmpRoot, 'voice.wav');
    metadataPath = path.join(workspaceRoot, 'metadata', 'transcript-blocks.json');

    await fs.mkdir(path.dirname(mainVideoPath), { recursive: true });
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(mainVideoPath, 'raw-video');
    await fs.writeFile(metadataPath, '{}');
    await fs.writeFile(audioPath, 'audio');

    ensureProjectScaffoldMock.mockResolvedValue({ workspaceRoot: path.join(tmpRoot, 'workspace') });
    ensureLanguageWorkspaceMock.mockResolvedValue({
      workspaceRoot: path.join(tmpRoot, 'workspace'),
      languageWorkspace: workspaceRoot,
      logsRoot: path.join(tmpRoot, 'logs'),
    });
    ensureLanguageLogDirMock.mockResolvedValue(path.join(tmpRoot, 'logs', 'en', 'video'));
    getLanguageProgressMock
      .mockResolvedValueOnce(progress(false))
      .mockResolvedValueOnce(progress(true));
    getTranscriptionSnapshotMock.mockResolvedValue({
      localPath: audioPath,
      finalVoiceovers: {
        en: { localPath: audioPath },
      },
    });
    buildFinalVideoMock.mockResolvedValue({
      logPath: path.join(tmpRoot, 'video.log'),
      finalVideoPath,
      overlays: [{ kind: 'captions', path: path.join(workspaceRoot, 'captions-video', 'out-alpha-validated.webm') }],
    });
    setFinalVideoMock.mockResolvedValue(undefined);
    setRawVideoMock.mockResolvedValue(undefined);
    updateLanguageProgressMock.mockResolvedValue(undefined);
    setStatusMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('uploads raw and final videos for character projects', async () => {
    const { handleVideoMainPhase } = await import('../../scripts/daemon/helpers/executor/video-main-phase');

    await handleVideoMainPhase({
      projectId: 'project-character',
      cfg: {
        projectExperience: 'character',
        targetLanguage: 'en',
        languages: ['en'],
        captionsEnabled: true,
        includeDefaultMusic: true,
        addOverlay: true,
        watermarkEnabled: true,
        template: null,
      } as any,
      jobPayload: {},
      daemonConfig: { scriptWorkspaceV2: '/tmp/not-dummy' } as any,
    });

    expect(setRawVideoMock).toHaveBeenCalledWith('project-character', mainVideoPath, 'en');
    expect(setFinalVideoMock).toHaveBeenCalledWith('project-character', finalVideoPath, 'en');
    expect(setStatusMock).toHaveBeenCalledWith(
      'project-character',
      ProjectStatus.Done,
      'Video ready',
      expect.objectContaining({
        rawVideoPaths: { en: mainVideoPath },
        finalVideoPaths: { en: finalVideoPath },
      }),
    );
  });

  it('does not upload raw videos for story projects', async () => {
    const { handleVideoMainPhase } = await import('../../scripts/daemon/helpers/executor/video-main-phase');

    await handleVideoMainPhase({
      projectId: 'project-story',
      cfg: {
        projectExperience: 'story',
        targetLanguage: 'en',
        languages: ['en'],
        captionsEnabled: true,
        includeDefaultMusic: true,
        addOverlay: true,
        watermarkEnabled: true,
        template: null,
      } as any,
      jobPayload: {},
      daemonConfig: { scriptWorkspaceV2: '/tmp/not-dummy' } as any,
    });

    expect(setRawVideoMock).not.toHaveBeenCalled();
    expect(setFinalVideoMock).toHaveBeenCalledWith('project-story', finalVideoPath, 'en');
  });
});
