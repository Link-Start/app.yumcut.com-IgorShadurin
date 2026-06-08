import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCreationSnapshot = vi.hoisted(() => vi.fn());
const setStatus = vi.hoisted(() => vi.fn(async () => {}));
const isProjectUnavailableError = vi.hoisted(() => vi.fn());
const handleScriptPhase = vi.hoisted(() => vi.fn());
const handleImagesPhase = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/db', () => ({
  getCreationSnapshot,
  setStatus,
  isProjectUnavailableError,
}));

vi.mock('../../scripts/daemon/helpers/executor/script-phase', () => ({
  handleScriptPhase,
}));

vi.mock('../../scripts/daemon/helpers/executor/audio-phase', () => ({
  handleAudioPhase: vi.fn(),
}));
vi.mock('../../scripts/daemon/helpers/executor/transcription-phase', () => ({
  handleTranscriptionPhase: vi.fn(),
}));
vi.mock('../../scripts/daemon/helpers/executor/metadata-phase', () => ({
  handleMetadataPhase: vi.fn(),
}));
vi.mock('../../scripts/daemon/helpers/executor/captions-phase', () => ({
  handleCaptionsPhase: vi.fn(),
}));
vi.mock('../../scripts/daemon/helpers/executor/images-phase', () => ({
  handleImagesPhase,
}));
vi.mock('../../scripts/daemon/helpers/executor/video-parts-phase', () => ({
  handleVideoPartsPhase: vi.fn(),
}));
vi.mock('../../scripts/daemon/helpers/executor/video-main-phase', () => ({
  handleVideoMainPhase: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/executor/context', () => ({
  getDaemonConfig: () => ({}),
  __setDaemonConfigForTests: vi.fn(),
}));

describe('daemon executor project-unavailable handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCreationSnapshot.mockResolvedValue({
      scriptCreationGuidanceEnabled: false,
      scriptCreationGuidance: '',
      scriptAvoidanceGuidanceEnabled: false,
      scriptAvoidanceGuidance: '',
      autoApproveScript: true,
      autoApproveAudio: true,
      includeDefaultMusic: true,
      addOverlay: true,
      includeCallToAction: true,
      useExactTextAsScript: false,
      durationSeconds: 30,
      targetLanguage: 'en',
      watermarkEnabled: true,
      captionsEnabled: true,
      audioStyleGuidanceEnabled: false,
      audioStyleGuidance: '',
      template: null,
      characterSelection: null,
    });
  });

  it('treats project-unavailable errors as handled and does not set project error status', async () => {
    handleScriptPhase.mockRejectedValueOnce(new Error('Daemon API 404 Not Found: Project not found'));
    isProjectUnavailableError.mockReturnValue(true);
    const { executeJob } = await import('../../scripts/daemon/helpers/executor');

    const ok = await executeJob({ id: 'job-1', projectId: 'project-1', type: 'script', payload: {} });
    expect(ok).toBe(true);
    expect(isProjectUnavailableError).toHaveBeenCalledTimes(1);
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('skips stale image jobs for character projects before executing the images phase', async () => {
    getCreationSnapshot.mockResolvedValueOnce({
      scriptCreationGuidanceEnabled: false,
      scriptCreationGuidance: '',
      scriptAvoidanceGuidanceEnabled: false,
      scriptAvoidanceGuidance: '',
      autoApproveScript: true,
      autoApproveAudio: true,
      includeDefaultMusic: true,
      addOverlay: true,
      includeCallToAction: true,
      useExactTextAsScript: false,
      projectExperience: 'character',
      durationSeconds: 30,
      targetLanguage: 'en',
      watermarkEnabled: true,
      captionsEnabled: true,
      audioStyleGuidanceEnabled: false,
      audioStyleGuidance: '',
      template: null,
      characterSelection: null,
    });
    const { executeJob } = await import('../../scripts/daemon/helpers/executor');

    const ok = await executeJob({ id: 'job-images', projectId: 'project-1', type: 'images', payload: {} });

    expect(ok).toBe(true);
    expect(handleImagesPhase).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('returns failed for handled phase failures that already set project error status', async () => {
    const { createHandledError } = await import('../../scripts/daemon/helpers/executor/error');
    handleScriptPhase.mockRejectedValueOnce(createHandledError('Script generation failed', new Error('OpenRouter 401')));
    isProjectUnavailableError.mockReturnValue(false);
    const { executeJob } = await import('../../scripts/daemon/helpers/executor');

    const ok = await executeJob({ id: 'job-1', projectId: 'project-1', type: 'script', payload: {} });
    expect(ok).toBe(false);
    expect(setStatus).not.toHaveBeenCalled();
  });
});
