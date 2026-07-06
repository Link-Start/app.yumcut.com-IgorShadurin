import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiKey = vi.hoisted(() => vi.fn());
const projectCreatePost = vi.hoisted(() => vi.fn());
const userFindUnique = vi.hoisted(() => vi.fn());
const attemptFindUnique = vi.hoisted(() => vi.fn());
const attemptCreate = vi.hoisted(() => vi.fn());
const projectFindFirst = vi.hoisted(() => vi.fn());
const userCharacterVariationFindFirst = vi.hoisted(() => vi.fn());

vi.mock('@/server/admin/api-auth', () => ({
  requireAdminApiKey,
}));

vi.mock('@/app/api/projects/route', () => ({
  POST: projectCreatePost,
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
    },
    projectCreationAttempt: {
      findUnique: attemptFindUnique,
      create: attemptCreate,
    },
    project: {
      findFirst: projectFindFirst,
    },
    userCharacterVariation: {
      findFirst: userCharacterVariationFindFirst,
    },
  },
}));

const projectsRoute = await import('@/app/api/admin/v1/projects/route');

describe('admin v1 write project API', () => {
  const createdAt = new Date('2026-07-06T10:00:00.000Z');
  const createdBodies: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    createdBodies.length = 0;
    requireAdminApiKey.mockResolvedValue({
      context: {
        keyId: 'key-1',
        keyName: 'Write key',
        createdByUserId: 'admin-1',
        scopes: ['read', 'write'],
      },
      error: null,
    });
    userFindUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      isAdmin: true,
      deleted: false,
      preferredLanguage: 'en',
    });
    attemptFindUnique.mockResolvedValue(null);
    attemptCreate.mockImplementation(async ({ data }: any) => ({
      id: 'attempt-1',
      ...data,
      projectId: null,
      project: null,
    }));
    projectCreatePost.mockImplementation(async (req: NextRequest) => {
      createdBodies.push(await req.json());
      return Response.json({
        id: 'project-1',
        title: 'Created project',
        status: 'new',
        createdAt: createdAt.toISOString(),
      });
    });
  });

  it('requires write scope and an idempotency key', async () => {
    const missingIdempotency = await projectsRoute.POST(new NextRequest('http://localhost/api/admin/v1/projects', {
      method: 'POST',
      body: JSON.stringify({ mode: 'manual', project: { prompt: 'Story', durationSeconds: 30 } }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(missingIdempotency.status).toBe(400);
    expect(requireAdminApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'write');
    expect(projectCreatePost).not.toHaveBeenCalled();
  });

  it('creates manual projects as the API key owner and injects the idempotency attempt id', async () => {
    const res = await projectsRoute.POST(new NextRequest('http://localhost/api/admin/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        project: {
          prompt: 'Create a short story',
          durationSeconds: 30,
          projectExperience: 'story',
          languages: ['en'],
        },
      }),
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'manual-1',
      },
    }));

    expect(res.status).toBe(200);
    expect(createdBodies).toHaveLength(1);
    expect(createdBodies[0]).toMatchObject({
      prompt: 'Create a short story',
      durationSeconds: 30,
      creationAttemptId: 'attempt-1',
    });
    const body = await res.json();
    expect(body).toMatchObject({
      mode: 'manual',
      ownerUserId: 'admin-1',
      idempotentReplay: false,
      item: { id: 'project-1' },
    });
  });

  it('returns an idempotent replay without creating another project', async () => {
    attemptFindUnique.mockResolvedValue({
      id: 'attempt-1',
      rawContext: { adminApi: {} },
      project: {
        id: 'project-1',
        title: 'Existing project',
        status: 'new',
        createdAt,
      },
    });

    const res = await projectsRoute.POST(new NextRequest('http://localhost/api/admin/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'manual',
        project: { prompt: 'Create a short story', durationSeconds: 30 },
      }),
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'manual-1',
      },
    }));

    expect(res.status).toBe(200);
    expect(projectCreatePost).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toMatchObject({
      idempotentReplay: true,
      item: { id: 'project-1', title: 'Existing project' },
    });
  });

  it('clones user-owned character selections as admin snapshot selections', async () => {
    projectFindFirst.mockResolvedValue({
      id: 'source-1',
      title: 'Failed source',
      prompt: 'Original prompt',
      rawScript: null,
      templateId: null,
      voiceId: 'Svetlana',
      contentTone: 'neutral',
      languages: ['ru'],
      selection: {
        userCharacterId: 'source-user-character',
        userCharacterVariationId: 'source-user-variation',
      },
      jobs: [
        {
          type: 'script',
          payload: {
            prompt: 'Original prompt',
            durationSeconds: 30,
            projectExperience: 'story',
            languages: ['ru'],
            voiceId: 'Svetlana',
            characterSelection: {
              userCharacterId: 'source-user-character',
              variationId: 'source-user-variation',
            },
          },
        },
      ],
    });
    userCharacterVariationFindFirst.mockResolvedValue({
      title: 'Source variation',
      imagePath: 'characters/2026/07/06/source.png',
      imageUrl: null,
      userCharacter: { title: 'Source character' },
    });

    const res = await projectsRoute.POST(new NextRequest('http://localhost/api/admin/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'clone',
        sourceProjectId: '11111111-1111-4111-8111-111111111111',
      }),
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'clone-1',
      },
    }));

    expect(res.status).toBe(200);
    expect(createdBodies[0]).toMatchObject({
      prompt: 'Original prompt',
      voiceId: 'Svetlana',
      languages: ['ru'],
      creationAttemptId: 'attempt-1',
      characterSelection: {
        source: 'snapshot',
        imagePath: 'characters/2026/07/06/source.png',
        label: 'Source variation',
      },
    });
    expect(createdBodies[0].characterSelection).not.toHaveProperty('userCharacterId');
  });
});
