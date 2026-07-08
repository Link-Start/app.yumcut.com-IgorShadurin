import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireUserApiKey = vi.hoisted(() => vi.fn());
const runWithAuthenticatedApiUser = vi.hoisted(() => vi.fn((_auth: unknown, run: () => unknown) => run()));
const normalizeUserApiIdempotencyKey = vi.hoisted(() => vi.fn((req: Request) => req.headers.get('idempotency-key')?.trim() || null));
const runIdempotentUserApiOperation = vi.hoisted(() => vi.fn(async (input: any) => input.run({ id: 'op-1' })));
const getCharacterCatalogProfileBySlug = vi.hoisted(() => vi.fn());
const listMobileCharacterCatalog = vi.hoisted(() => vi.fn());
const getPublicImagePrankItemBySlug = vi.hoisted(() => vi.fn());

const handlers = vi.hoisted(() => {
  const make = (name: string) => vi.fn(async () => Response.json({ proxied: name }));
  return {
    mobileSettingsGet: make('settings.get'),
    mobileSettingsPatch: make('settings.patch'),
    projectsPost: make('projects.post'),
    projectGet: make('project.get'),
    projectDelete: make('project.delete'),
    projectStatusGet: make('project.status.get'),
    projectStopPost: make('project.stop.post'),
    projectVideoDownloadGet: make('project.downloads.video.get'),
    projectImageDownloadGet: make('project.downloads.image.get'),
    scriptApprovePost: make('project.script.approve.post'),
    scriptRequestPost: make('project.script.request.post'),
    scriptFinalPost: make('project.script.final.post'),
    audiosGet: make('project.audios.get'),
    audiosApprovePost: make('project.audios.approve.post'),
    audiosRequestPost: make('project.audios.request.post'),
    audiosRegeneratePost: make('project.audios.regenerate.post'),
    imagePrankReuseGet: make('project.image-prank-reuse.get'),
    imagesRegeneratePost: make('project.images.regenerate.post'),
    imagesReplacePost: make('project.images.replace.post'),
    videoRecreatePost: make('project.video.recreate.post'),
    voicesGet: make('voices.get'),
    templatesGet: make('templates.get'),
    templateGet: make('templates.id.get'),
    imagePranksGet: make('image-pranks.get'),
    uploadTokenPost: make('storage.upload-token.post'),
    mediaGrantPost: make('media.grant.post'),
    groupsPost: make('groups.post'),
    charactersGet: make('characters.get'),
    characterPreviewImageGet: make('characters.variations.preview-image.get'),
    favoritePost: make('characters.favorite.post'),
    favoriteDelete: make('characters.favorite.delete'),
    customUploadPost: make('characters.custom.upload.post'),
    customGeneratePost: make('characters.custom.generate.post'),
    minePost: make('characters.mine.post'),
    variationPost: make('characters.mine.variations.post'),
    variationDelete: make('characters.mine.variations.delete'),
    schedulerSettingsGet: make('scheduler.settings.get'),
    schedulerSettingsPost: make('scheduler.settings.post'),
    schedulerChannelsPost: make('scheduler.channels.post'),
    schedulerChannelDelete: make('scheduler.channels.delete'),
    schedulerChannelRevokePost: make('scheduler.channels.revoke.post'),
    schedulerProjectPost: make('scheduler.projects.post'),
    schedulerTaskCleanupPost: make('scheduler.tasks.cleanup-request.post'),
    telegramAccountGet: make('telegram.account.get'),
    telegramAccountDelete: make('telegram.account.delete'),
    telegramLinkTokenPost: make('telegram.link-token.post'),
  };
});

vi.mock('@/server/user-api/api-auth', () => ({ requireUserApiKey }));
vi.mock('@/server/user-api/api-idempotency', () => ({
  normalizeUserApiIdempotencyKey,
  runIdempotentUserApiOperation,
}));
vi.mock('@/server/api-user', () => ({ runWithAuthenticatedApiUser }));
vi.mock('@/server/character-catalog', () => ({
  getCharacterCatalogProfileBySlug,
  listMobileCharacterCatalog,
}));
vi.mock('@/server/image-pranks', () => ({ getPublicImagePrankItemBySlug }));

vi.mock('@/app/api/mobile/settings/route', () => ({ GET: handlers.mobileSettingsGet, PATCH: handlers.mobileSettingsPatch }));
vi.mock('@/app/api/projects/route', () => ({ POST: handlers.projectsPost }));
vi.mock('@/app/api/projects/[projectId]/route', () => ({ GET: handlers.projectGet, DELETE: handlers.projectDelete }));
vi.mock('@/app/api/projects/[projectId]/status/route', () => ({ GET: handlers.projectStatusGet }));
vi.mock('@/app/api/projects/[projectId]/stop/route', () => ({ POST: handlers.projectStopPost }));
vi.mock('@/app/api/projects/[projectId]/video/download/route', () => ({ GET: handlers.projectVideoDownloadGet }));
vi.mock('@/app/api/projects/[projectId]/image/download/route', () => ({ GET: handlers.projectImageDownloadGet }));
vi.mock('@/app/api/projects/[projectId]/script/approve/route', () => ({ POST: handlers.scriptApprovePost }));
vi.mock('@/app/api/projects/[projectId]/script/request/route', () => ({ POST: handlers.scriptRequestPost }));
vi.mock('@/app/api/projects/[projectId]/script/final/route', () => ({ POST: handlers.scriptFinalPost }));
vi.mock('@/app/api/projects/[projectId]/audios/route', () => ({ GET: handlers.audiosGet }));
vi.mock('@/app/api/projects/[projectId]/audios/approve/route', () => ({ POST: handlers.audiosApprovePost }));
vi.mock('@/app/api/projects/[projectId]/audios/request/route', () => ({ POST: handlers.audiosRequestPost }));
vi.mock('@/app/api/projects/[projectId]/audios/regenerate/route', () => ({ POST: handlers.audiosRegeneratePost }));
vi.mock('@/app/api/projects/[projectId]/image-prank-reuse/route', () => ({ GET: handlers.imagePrankReuseGet }));
vi.mock('@/app/api/projects/[projectId]/images/regenerate/route', () => ({ POST: handlers.imagesRegeneratePost }));
vi.mock('@/app/api/projects/[projectId]/images/replace/route', () => ({ POST: handlers.imagesReplacePost }));
vi.mock('@/app/api/projects/[projectId]/video/recreate/route', () => ({ POST: handlers.videoRecreatePost }));
vi.mock('@/app/api/voices/route', () => ({ GET: handlers.voicesGet }));
vi.mock('@/app/api/templates/route', () => ({ GET: handlers.templatesGet }));
vi.mock('@/app/api/templates/[id]/route', () => ({ GET: handlers.templateGet }));
vi.mock('@/app/api/image-pranks/route', () => ({ GET: handlers.imagePranksGet }));
vi.mock('@/app/api/storage/upload-token/route', () => ({ POST: handlers.uploadTokenPost }));
vi.mock('@/app/api/media/grant/route', () => ({ POST: handlers.mediaGrantPost }));
vi.mock('@/app/api/groups/route', () => ({ POST: handlers.groupsPost }));
vi.mock('@/app/api/characters/route', () => ({ GET: handlers.charactersGet }));
vi.mock('@/app/api/characters/variations/[variationId]/preview-image/route', () => ({ GET: handlers.characterPreviewImageGet }));
vi.mock('@/app/api/characters/[slug]/favorite/route', () => ({ POST: handlers.favoritePost, DELETE: handlers.favoriteDelete }));
vi.mock('@/app/api/characters/custom/upload/route', () => ({ POST: handlers.customUploadPost }));
vi.mock('@/app/api/characters/custom/generate/route', () => ({ POST: handlers.customGeneratePost }));
vi.mock('@/app/api/characters/mine/route', () => ({ POST: handlers.minePost }));
vi.mock('@/app/api/characters/mine/[userCharacterId]/variations/route', () => ({ POST: handlers.variationPost }));
vi.mock('@/app/api/characters/mine/[userCharacterId]/variations/[variationId]/route', () => ({ DELETE: handlers.variationDelete }));
vi.mock('@/app/api/scheduler/settings/route', () => ({ GET: handlers.schedulerSettingsGet, POST: handlers.schedulerSettingsPost }));
vi.mock('@/app/api/scheduler/channels/route', () => ({ POST: handlers.schedulerChannelsPost }));
vi.mock('@/app/api/scheduler/channels/[channelId]/route', () => ({ DELETE: handlers.schedulerChannelDelete }));
vi.mock('@/app/api/scheduler/channels/[channelId]/revoke/route', () => ({ POST: handlers.schedulerChannelRevokePost }));
vi.mock('@/app/api/scheduler/projects/[projectId]/route', () => ({ POST: handlers.schedulerProjectPost }));
vi.mock('@/app/api/scheduler/tasks/[taskId]/cleanup-request/route', () => ({ POST: handlers.schedulerTaskCleanupPost }));
vi.mock('@/app/api/telegram/account/route', () => ({ GET: handlers.telegramAccountGet, DELETE: handlers.telegramAccountDelete }));
vi.mock('@/app/api/telegram/link-token/route', () => ({ POST: handlers.telegramLinkTokenPost }));

const route = await import('@/app/api/user/v1/[...path]/route');

const authContext = {
  keyId: 'key-1',
  keyName: 'Automation',
  userId: 'user-1',
  scopes: ['read', 'write'],
  sessionUser: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    isAdmin: false,
    preferredLanguage: 'en',
  },
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ProxyCase = {
  method: Method;
  path: string;
  handler: ReturnType<typeof vi.fn>;
  params?: Record<string, string>;
  idempotentAction?: string;
};

const proxyCases: ProxyCase[] = [
  { method: 'GET', path: 'settings', handler: handlers.mobileSettingsGet },
  { method: 'PATCH', path: 'settings', handler: handlers.mobileSettingsPatch },
  { method: 'POST', path: 'projects', handler: handlers.projectsPost, idempotentAction: 'project.create' },
  { method: 'GET', path: 'projects/project-1', handler: handlers.projectGet, params: { projectId: 'project-1' } },
  { method: 'DELETE', path: 'projects/project-1', handler: handlers.projectDelete, params: { projectId: 'project-1' } },
  { method: 'GET', path: 'projects/project-1/status', handler: handlers.projectStatusGet, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/stop', handler: handlers.projectStopPost, params: { projectId: 'project-1' } },
  { method: 'GET', path: 'projects/project-1/downloads/video', handler: handlers.projectVideoDownloadGet, params: { projectId: 'project-1' } },
  { method: 'GET', path: 'projects/project-1/downloads/image', handler: handlers.projectImageDownloadGet, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/script/approve', handler: handlers.scriptApprovePost, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/script/request', handler: handlers.scriptRequestPost, params: { projectId: 'project-1' }, idempotentAction: 'project.script.request' },
  { method: 'POST', path: 'projects/project-1/script/final', handler: handlers.scriptFinalPost, params: { projectId: 'project-1' } },
  { method: 'GET', path: 'projects/project-1/audios', handler: handlers.audiosGet, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/audios/approve', handler: handlers.audiosApprovePost, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/audios/request', handler: handlers.audiosRequestPost, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/audios/regenerate', handler: handlers.audiosRegeneratePost, params: { projectId: 'project-1' }, idempotentAction: 'project.audio.regenerate' },
  { method: 'GET', path: 'projects/project-1/image-prank-reuse', handler: handlers.imagePrankReuseGet, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/images/regenerate', handler: handlers.imagesRegeneratePost, params: { projectId: 'project-1' }, idempotentAction: 'project.image.regenerate' },
  { method: 'POST', path: 'projects/project-1/images/replace', handler: handlers.imagesReplacePost, params: { projectId: 'project-1' } },
  { method: 'POST', path: 'projects/project-1/video/recreate', handler: handlers.videoRecreatePost, params: { projectId: 'project-1' }, idempotentAction: 'project.video.recreate' },
  { method: 'GET', path: 'voices', handler: handlers.voicesGet },
  { method: 'GET', path: 'templates', handler: handlers.templatesGet },
  { method: 'GET', path: 'templates/template-1', handler: handlers.templateGet, params: { id: 'template-1' } },
  { method: 'GET', path: 'image-pranks', handler: handlers.imagePranksGet },
  { method: 'POST', path: 'storage/upload-token', handler: handlers.uploadTokenPost },
  { method: 'POST', path: 'media/grant', handler: handlers.mediaGrantPost },
  { method: 'POST', path: 'groups', handler: handlers.groupsPost, idempotentAction: 'group.create' },
  { method: 'GET', path: 'characters', handler: handlers.charactersGet },
  { method: 'GET', path: 'characters/variations/variation-1/preview-image', handler: handlers.characterPreviewImageGet, params: { variationId: 'variation-1' } },
  { method: 'POST', path: 'characters/kim-masters/favorite', handler: handlers.favoritePost, params: { slug: 'kim-masters' } },
  { method: 'DELETE', path: 'characters/kim-masters/favorite', handler: handlers.favoriteDelete, params: { slug: 'kim-masters' } },
  { method: 'POST', path: 'characters/custom/upload', handler: handlers.customUploadPost },
  { method: 'POST', path: 'characters/custom/generate', handler: handlers.customGeneratePost, idempotentAction: 'character.generate' },
  { method: 'POST', path: 'characters/mine', handler: handlers.minePost },
  { method: 'POST', path: 'characters/mine/user-character-1/variations', handler: handlers.variationPost, params: { userCharacterId: 'user-character-1' } },
  { method: 'DELETE', path: 'characters/mine/user-character-1/variations/variation-1', handler: handlers.variationDelete, params: { userCharacterId: 'user-character-1', variationId: 'variation-1' } },
  { method: 'GET', path: 'scheduler/settings', handler: handlers.schedulerSettingsGet },
  { method: 'POST', path: 'scheduler/settings', handler: handlers.schedulerSettingsPost },
  { method: 'PATCH', path: 'scheduler/settings', handler: handlers.schedulerSettingsPost },
  { method: 'POST', path: 'scheduler/channels', handler: handlers.schedulerChannelsPost },
  { method: 'DELETE', path: 'scheduler/channels/channel-1', handler: handlers.schedulerChannelDelete, params: { channelId: 'channel-1' } },
  { method: 'POST', path: 'scheduler/channels/channel-1/revoke', handler: handlers.schedulerChannelRevokePost, params: { channelId: 'channel-1' } },
  { method: 'POST', path: 'scheduler/projects/project-1', handler: handlers.schedulerProjectPost, params: { projectId: 'project-1' }, idempotentAction: 'scheduler.project.schedule' },
  { method: 'POST', path: 'scheduler/tasks/task-1/cleanup-request', handler: handlers.schedulerTaskCleanupPost, params: { taskId: 'task-1' } },
  { method: 'GET', path: 'telegram/account', handler: handlers.telegramAccountGet },
  { method: 'DELETE', path: 'telegram/account', handler: handlers.telegramAccountDelete },
  { method: 'POST', path: 'telegram/link-token', handler: handlers.telegramLinkTokenPost },
];

function paramsFor(path: string) {
  return { params: Promise.resolve({ path: path.split('/').filter(Boolean) }) };
}

function requestFor(input: { method: Method; path: string; idempotent?: boolean }) {
  const headers = new Headers({ authorization: 'Bearer ycu_test' });
  if (input.method !== 'GET') headers.set('content-type', 'application/json');
  if (input.idempotent) headers.set('idempotency-key', `idem-${input.path}`);
  return new NextRequest(`http://localhost/api/user/v1/${input.path}`, {
    method: input.method,
    headers,
    body: input.method === 'GET' || input.method === 'DELETE' ? undefined : JSON.stringify({ ok: true }),
  });
}

async function callUserApi(input: { method: Method; path: string; idempotent?: boolean }) {
  return route[input.method](requestFor(input), paramsFor(input.path));
}

describe('user v1 API proxy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserApiKey.mockResolvedValue({ context: authContext, error: null });
    getCharacterCatalogProfileBySlug.mockResolvedValue({ id: 'character-profile', slug: 'kim-masters' });
    listMobileCharacterCatalog.mockResolvedValue([
      {
        id: 'funny',
        title: { en: 'Funny', ru: 'Смешные' },
        characters: [{ id: 'char-1', slug: 'kim-masters', previewImageUrl: '/api/characters/variations/variation-1/preview-image?h=896' }],
      },
    ]);
    getPublicImagePrankItemBySlug.mockResolvedValue({
      id: 'prank-1',
      slug: 'giant-billboard',
      title: { en: 'Giant billboard', ru: 'Огромный билборд' },
      imageUrl: 'https://storage.test/prank.png',
      previewImageUrl: 'https://storage.test/prank-preview.png',
    });
  });

  for (const testCase of proxyCases) {
    it(`proxies ${testCase.method} /${testCase.path} with user API auth boundaries`, async () => {
      const res = await callUserApi({
        method: testCase.method,
        path: testCase.path,
        idempotent: Boolean(testCase.idempotentAction),
      });

      expect(res.status).toBe(200);
      expect(requireUserApiKey).toHaveBeenCalledWith(
        expect.any(NextRequest),
        testCase.method === 'GET' ? 'read' : 'write',
      );
      expect(runWithAuthenticatedApiUser).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        source: 'user-api',
        sessionUser: expect.objectContaining({ isAdmin: false }),
      }), expect.any(Function));
      expect(testCase.handler).toHaveBeenCalledTimes(1);
      if (testCase.params) {
        const context = testCase.handler.mock.calls[0]?.[1];
        expect(context).toBeTruthy();
        await expect(context.params).resolves.toEqual(testCase.params);
      }

      if (testCase.idempotentAction) {
        expect(normalizeUserApiIdempotencyKey).toHaveBeenCalledWith(expect.any(NextRequest));
        expect(runIdempotentUserApiOperation).toHaveBeenCalledWith(expect.objectContaining({
          auth: authContext,
          action: testCase.idempotentAction,
          idempotencyKey: `idem-${testCase.path}`,
        }));
      } else {
        expect(runIdempotentUserApiOperation).not.toHaveBeenCalled();
      }
    });
  }

  it('returns catalog character profiles through an owner-aware lookup', async () => {
    const res = await callUserApi({ method: 'GET', path: 'characters/kim-masters' });

    expect(res.status).toBe(200);
    expect(getCharacterCatalogProfileBySlug).toHaveBeenCalledWith('kim-masters', { viewerUserId: 'user-1' });
    await expect(res.json()).resolves.toEqual({ id: 'character-profile', slug: 'kim-masters' });
  });

  it('returns the public character catalog with viewer-aware metrics and preview media', async () => {
    const res = await callUserApi({ method: 'GET', path: 'characters/catalog' });

    expect(res.status).toBe(200);
    expect(requireUserApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'read');
    expect(listMobileCharacterCatalog).toHaveBeenCalledWith('user-1');
    await expect(res.json()).resolves.toMatchObject({
      categories: [
        {
          id: 'funny',
          characters: [
            {
              slug: 'kim-masters',
              previewImageUrl: '/api/characters/variations/variation-1/preview-image?h=896',
            },
          ],
        },
      ],
    });
  });

  it('returns a public Image Prank catalog item by slug with preview media', async () => {
    const res = await callUserApi({ method: 'GET', path: 'image-pranks/giant-billboard' });

    expect(res.status).toBe(200);
    expect(requireUserApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'read');
    expect(getPublicImagePrankItemBySlug).toHaveBeenCalledWith('giant-billboard');
    await expect(res.json()).resolves.toMatchObject({
      slug: 'giant-billboard',
      imageUrl: 'https://storage.test/prank.png',
      previewImageUrl: 'https://storage.test/prank-preview.png',
    });
  });

  it('does not disclose non-public or missing Image Prank items by slug', async () => {
    getPublicImagePrankItemBySlug.mockResolvedValueOnce(null);

    const res = await callUserApi({ method: 'GET', path: 'image-pranks/private-prank' });

    expect(res.status).toBe(404);
    expect(getPublicImagePrankItemBySlug).toHaveBeenCalledWith('private-prank');
  });

  it('keeps billing, subscription, account deletion, and admin paths unavailable', async () => {
    const blocked: Array<{ method: Method; path: string }> = [
      { method: 'GET', path: 'subscriptions/status' },
      { method: 'POST', path: 'subscriptions/checkout' },
      { method: 'POST', path: 'account/delete' },
      { method: 'GET', path: 'admin/users' },
      { method: 'POST', path: 'daemon/jobs/queue' },
    ];

    for (const item of blocked) {
      vi.clearAllMocks();
      requireUserApiKey.mockResolvedValue({ context: authContext, error: null });
      const res = await callUserApi(item);
      expect(res.status, `${item.method} /${item.path}`).toBe(404);
      expect(runWithAuthenticatedApiUser).toHaveBeenCalledWith(expect.objectContaining({
        source: 'user-api',
        userId: 'user-1',
      }), expect.any(Function));
    }

    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
