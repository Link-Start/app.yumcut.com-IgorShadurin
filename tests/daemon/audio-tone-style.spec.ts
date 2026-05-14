import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLanguageProgressMock = vi.hoisted(() => vi.fn());
const getScriptTextMock = vi.hoisted(() => vi.fn());
const markLanguageFailureMock = vi.hoisted(() => vi.fn());
const setStatusMock = vi.hoisted(() => vi.fn());
const updateLanguageProgressMock = vi.hoisted(() => vi.fn());
const createJobMock = vi.hoisted(() => vi.fn());
const addAudioCandidateMock = vi.hoisted(() => vi.fn());
const generateVoiceoversMock = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../scripts/daemon/helpers/db', () => ({
  getLanguageProgress: getLanguageProgressMock,
  getScriptText: getScriptTextMock,
  markLanguageFailure: markLanguageFailureMock,
  setStatus: setStatusMock,
  updateLanguageProgress: updateLanguageProgressMock,
  createJob: createJobMock,
  addAudioCandidate: addAudioCandidateMock,
}));

vi.mock('../../scripts/daemon/helpers/language-workspace', () => ({
  ensureProjectScaffold: vi.fn(async () => ({ workspaceRoot: '/tmp/project' })),
  ensureLanguageWorkspace: vi.fn(async () => ({
    workspaceRoot: '/tmp/project',
    languageWorkspace: '/tmp/project/en',
  })),
}));

vi.mock('../../scripts/daemon/helpers/prompt-to-wav', () => ({
  generateVoiceovers: generateVoiceoversMock,
}));

describe('audio phase tone style mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLanguageProgressMock.mockResolvedValue({
      progress: [],
      aggregate: {
        transcription: { done: false, remaining: ['en'] },
        captions: { done: false, remaining: ['en'] },
        videoParts: { done: false, remaining: ['en'] },
        finalVideo: { done: false, remaining: ['en'] },
      },
    });
    getScriptTextMock.mockResolvedValue('Sample narration script');
    generateVoiceoversMock.mockResolvedValue({
      runDirectory: '/tmp/project/en/audio/run-1',
      outputs: [{ path: '/tmp/project/en/audio/run-1/take-1.wav' }],
      error: null,
    });
    addAudioCandidateMock.mockResolvedValue({
      id: 'audio-1',
      path: '/audio/audio-1.wav',
      url: 'https://example.com/audio/audio-1.wav',
      localPath: '/tmp/project/en/audio/run-1/take-1.wav',
    });
    setStatusMock.mockResolvedValue(undefined);
    updateLanguageProgressMock.mockResolvedValue(undefined);
    createJobMock.mockResolvedValue(undefined);
    markLanguageFailureMock.mockResolvedValue(undefined);
  });

  it('applies playful style prompt for elevenlabs', async () => {
    const { handleAudioPhase } = await import('../../scripts/daemon/helpers/executor/audio-phase');

    await handleAudioPhase({
      projectId: 'project-tone-eleven',
      cfg: {
        autoApproveAudio: true,
        targetLanguage: 'en',
        languages: ['en'],
        contentTone: 'playful',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        voiceAssignments: {
          en: {
            voiceId: 'voice-eleven',
            voiceProvider: 'elevenlabs',
            source: 'project',
            templateVoiceId: null,
            title: null,
            speed: null,
            gender: null,
          },
        },
        voiceProviders: {
          'voice-eleven': 'elevenlabs',
        },
        template: null,
      } as any,
      jobPayload: {},
    });

    expect(generateVoiceoversMock).toHaveBeenCalledTimes(1);
    expect(generateVoiceoversMock).toHaveBeenCalledWith(expect.objectContaining({
      voiceProvider: 'elevenlabs',
      style: expect.stringContaining('Playful'),
    }));
  });

  it('does not pass style prompt for providers without style support', async () => {
    const { handleAudioPhase } = await import('../../scripts/daemon/helpers/executor/audio-phase');

    await handleAudioPhase({
      projectId: 'project-tone-minimax',
      cfg: {
        autoApproveAudio: true,
        targetLanguage: 'en',
        languages: ['en'],
        contentTone: 'angry',
        audioStyleGuidanceEnabled: true,
        audioStyleGuidance: 'keep short pauses',
        voiceAssignments: {
          en: {
            voiceId: 'voice-minimax',
            voiceProvider: 'minimax',
            source: 'project',
            templateVoiceId: null,
            title: null,
            speed: null,
            gender: null,
          },
        },
        voiceProviders: {
          'voice-minimax': 'minimax',
        },
        template: null,
      } as any,
      jobPayload: {},
    });

    expect(generateVoiceoversMock).toHaveBeenCalledTimes(1);
    expect(generateVoiceoversMock).toHaveBeenCalledWith(expect.objectContaining({
      voiceProvider: 'minimax',
      style: null,
    }));
  });
});
