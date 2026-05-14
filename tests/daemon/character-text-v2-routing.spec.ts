import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateScriptMock = vi.hoisted(() => vi.fn());
const refineScriptMock = vi.hoisted(() => vi.fn());
const generateCharacterScriptV2Mock = vi.hoisted(() => vi.fn());
const refineCharacterScriptV2Mock = vi.hoisted(() => vi.fn());
const setStatusMock = vi.hoisted(() => vi.fn());
const upsertScriptMock = vi.hoisted(() => vi.fn());
const markLanguageFailureMock = vi.hoisted(() => vi.fn());
const getScriptTextMock = vi.hoisted(() => vi.fn());

vi.mock('../../scripts/daemon/helpers/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../scripts/daemon/helpers/script-archive', () => ({
  archiveInitialSuccess: vi.fn(),
  archiveRefinementSuccess: vi.fn(),
  archiveInitialError: vi.fn(),
  archiveRefinementError: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/prompt-to-text', () => ({
  generateScript: generateScriptMock,
  refineScript: refineScriptMock,
  PromptToTextError: class PromptToTextError extends Error {},
}));

vi.mock('../../scripts/daemon/helpers/character-text-v2', () => ({
  generateCharacterScriptV2: generateCharacterScriptV2Mock,
  refineCharacterScriptV2: refineCharacterScriptV2Mock,
  CharacterTextV2Error: class CharacterTextV2Error extends Error {
    command: string;

    constructor(message: string, command = 'structured:simple') {
      super(message);
      this.command = command;
    }
  },
}));

vi.mock('../../scripts/daemon/helpers/translate', () => ({
  translateScript: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/db', () => ({
  setStatus: setStatusMock,
  upsertScript: upsertScriptMock,
  markLanguageFailure: markLanguageFailureMock,
  getScriptText: getScriptTextMock,
  addImageAsset: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/language-workspace', () => ({
  ensureLanguageWorkspace: vi.fn(async (projectId: string, languageCode: string) => ({
    workspaceRoot: `/tmp/${projectId}`,
    languageWorkspace: `/tmp/${projectId}/${languageCode}`,
    logsRoot: `/tmp/${projectId}/logs`,
  })),
  ensureTemplateWorkspace: vi.fn(),
  ensureLanguageLogDir: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/template-launch', () => ({
  runTemplateLaunch: vi.fn(),
  loadTemplateLaunchSnapshotIfExists: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/metadata', () => ({
  generateMetadata: vi.fn(),
}));

vi.mock('../../scripts/daemon/helpers/template-original', () => ({
  rememberTemplateOriginalPath: vi.fn(),
  saveTemplateOriginalScript: vi.fn(),
}));

describe('script phase character v2 routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStatusMock.mockResolvedValue(undefined);
    upsertScriptMock.mockResolvedValue(undefined);
    markLanguageFailureMock.mockResolvedValue(undefined);
    generateScriptMock.mockResolvedValue({ text: 'legacy text', command: 'legacy-cmd' });
    generateCharacterScriptV2Mock.mockResolvedValue({ text: 'character text', command: 'v2-cmd' });
  });

  it('uses v2 text generator for character projects', async () => {
    const { handleScriptPhase } = await import('../../scripts/daemon/helpers/executor/script-phase');

    await handleScriptPhase({
      projectId: 'project-character',
      cfg: {
        autoApproveScript: true,
        autoApproveAudio: true,
        includeDefaultMusic: true,
        addOverlay: true,
        useExactTextAsScript: false,
        durationSeconds: 30,
        targetLanguage: 'en',
        languages: ['en'],
        watermarkEnabled: true,
        captionsEnabled: true,
        scriptCreationGuidanceEnabled: false,
        scriptCreationGuidance: '',
        scriptAvoidanceGuidanceEnabled: false,
        scriptAvoidanceGuidance: '',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        contentTone: 'playful',
        projectExperience: 'character',
        characterSelection: null,
        template: null,
      } as any,
      jobPayload: {
        prompt: 'make a short fun monologue',
        projectExperience: 'character',
        contentTone: 'playful',
      },
      creationGuidance: '',
      avoidanceGuidance: '',
    });

    expect(generateCharacterScriptV2Mock).toHaveBeenCalledTimes(1);
    expect(generateCharacterScriptV2Mock).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'make a short fun monologue',
      tone: 'playful',
    }));
    expect(generateScriptMock).not.toHaveBeenCalled();
    expect(upsertScriptMock).toHaveBeenCalledWith('project-character', 'character text', 'en');
  });

  it('keeps legacy generator for non-character projects', async () => {
    const { handleScriptPhase } = await import('../../scripts/daemon/helpers/executor/script-phase');

    await handleScriptPhase({
      projectId: 'project-story',
      cfg: {
        autoApproveScript: true,
        autoApproveAudio: true,
        includeDefaultMusic: true,
        addOverlay: true,
        useExactTextAsScript: false,
        durationSeconds: 30,
        targetLanguage: 'en',
        languages: ['en'],
        watermarkEnabled: true,
        captionsEnabled: true,
        scriptCreationGuidanceEnabled: false,
        scriptCreationGuidance: '',
        scriptAvoidanceGuidanceEnabled: false,
        scriptAvoidanceGuidance: '',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        contentTone: 'neutral',
        projectExperience: 'story',
        characterSelection: null,
        template: null,
      } as any,
      jobPayload: {
        prompt: 'tell a story',
        projectExperience: 'story',
      },
      creationGuidance: '',
      avoidanceGuidance: '',
    });

    expect(generateScriptMock).toHaveBeenCalledTimes(1);
    expect(generateCharacterScriptV2Mock).not.toHaveBeenCalled();
    expect(upsertScriptMock).toHaveBeenCalledWith('project-story', 'legacy text', 'en');
  });

  it('uses exact script text for character projects without invoking generators', async () => {
    const { handleScriptPhase } = await import('../../scripts/daemon/helpers/executor/script-phase');

    await handleScriptPhase({
      projectId: 'project-character-exact',
      cfg: {
        autoApproveScript: true,
        autoApproveAudio: true,
        includeDefaultMusic: true,
        addOverlay: true,
        useExactTextAsScript: true,
        durationSeconds: 30,
        targetLanguage: 'en',
        languages: ['en'],
        watermarkEnabled: true,
        captionsEnabled: true,
        scriptCreationGuidanceEnabled: false,
        scriptCreationGuidance: '',
        scriptAvoidanceGuidanceEnabled: false,
        scriptAvoidanceGuidance: '',
        audioStyleGuidanceEnabled: false,
        audioStyleGuidance: '',
        contentTone: 'neutral',
        projectExperience: 'character',
        characterSelection: null,
        template: null,
      } as any,
      jobPayload: {
        useExactTextAsScript: true,
        rawScript: 'Use this exact character text',
        projectExperience: 'character',
      },
      creationGuidance: '',
      avoidanceGuidance: '',
    });

    expect(generateScriptMock).not.toHaveBeenCalled();
    expect(generateCharacterScriptV2Mock).not.toHaveBeenCalled();
    expect(upsertScriptMock).toHaveBeenCalledWith('project-character-exact', 'Use this exact character text', 'en');
  });
});
