import { beforeEach, describe, expect, it, vi } from 'vitest';

const userApiKeyCreate = vi.hoisted(() => vi.fn());
const userApiKeyFindUnique = vi.hoisted(() => vi.fn());
const userApiKeyUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    userApiKey: {
      create: userApiKeyCreate,
      findUnique: userApiKeyFindUnique,
      update: userApiKeyUpdate,
    },
  },
}));

const {
  createUserApiKey,
  hashUserApiKeyToken,
} = await import('@/server/user-api/api-keys');
const { requireUserApiKey } = await import('@/server/user-api/api-auth');

const createdAt = new Date('2026-07-08T10:00:00.000Z');

describe('user API keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userApiKeyUpdate.mockResolvedValue({});
    userApiKeyCreate.mockImplementation(async ({ data }: any) => ({
      id: 'key-1',
      ...data,
      createdAt,
      revokedAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      lastUsedUserAgent: null,
    }));
  });

  it('returns plaintext once and stores only a hash with read/write defaults', async () => {
    const result = await createUserApiKey({
      userId: 'user-1',
      name: ' Automation key ',
    });

    expect(result.key).toMatch(/^ycu_/);
    expect(userApiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        name: 'Automation key',
        tokenHash: expect.any(String),
        tokenPrefix: expect.stringMatching(/^ycu_/),
        scopes: ['read', 'write'],
      }),
    }));
    const storedHash = userApiKeyCreate.mock.calls[0]?.[0]?.data?.tokenHash;
    expect(storedHash).toBe(hashUserApiKeyToken(result.key));
    expect(storedHash).not.toBe(result.key);
    expect(result.item).not.toHaveProperty('tokenHash');
  });

  it('stores explicit read-only scopes', async () => {
    await createUserApiKey({
      userId: 'user-1',
      name: 'Read key',
      scopes: ['read'],
    });

    expect(userApiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scopes: ['read'],
      }),
    }));
  });

  it('authenticates active keys and strips admin privileges from reused user routes', async () => {
    userApiKeyFindUnique.mockResolvedValue({
      id: 'key-1',
      name: 'Automation key',
      userId: 'admin-user',
      revokedAt: null,
      scopes: ['read', 'write'],
      user: {
        id: 'admin-user',
        email: 'admin@example.com',
        name: 'Admin',
        isAdmin: true,
        deleted: false,
        preferredLanguage: 'en',
      },
    });
    const req = new Request('http://localhost/api/user/v1/projects', {
      headers: {
        authorization: 'Bearer ycu_test',
        'user-agent': 'vitest',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });

    const result = await requireUserApiKey(req, 'write');

    expect(result.error).toBeNull();
    expect(result.context).toMatchObject({
      keyId: 'key-1',
      userId: 'admin-user',
      scopes: ['read', 'write'],
      sessionUser: {
        id: 'admin-user',
        email: 'admin@example.com',
        isAdmin: false,
        preferredLanguage: 'en',
      },
    });
    expect(userApiKeyFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashUserApiKeyToken('ycu_test') },
    }));
    expect(userApiKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'key-1' },
      data: expect.objectContaining({
        lastUsedAt: expect.any(Date),
        lastUsedIp: '203.0.113.10',
        lastUsedUserAgent: 'vitest',
      }),
    }));
  });

  it('rejects missing, revoked, deleted-owner, and insufficient-scope keys', async () => {
    const missing = await requireUserApiKey(new Request('http://localhost/api/user/v1/projects'), 'read');
    expect(missing.error?.status).toBe(401);

    userApiKeyFindUnique.mockResolvedValueOnce({
      id: 'key-1',
      revokedAt: new Date(),
      scopes: ['read'],
      user: { id: 'user-1', deleted: false },
    });
    const revoked = await requireUserApiKey(new Request('http://localhost/api/user/v1/projects', {
      headers: { authorization: 'Bearer ycu_revoked' },
    }), 'read');
    expect(revoked.error?.status).toBe(401);

    userApiKeyFindUnique.mockResolvedValueOnce({
      id: 'key-2',
      name: 'Old key',
      userId: 'user-2',
      revokedAt: null,
      scopes: ['read'],
      user: { id: 'user-2', deleted: true },
    });
    const deletedOwner = await requireUserApiKey(new Request('http://localhost/api/user/v1/projects', {
      headers: { authorization: 'Bearer ycu_deleted' },
    }), 'read');
    expect(deletedOwner.error?.status).toBe(403);

    userApiKeyFindUnique.mockResolvedValueOnce({
      id: 'key-3',
      name: 'Read key',
      userId: 'user-3',
      revokedAt: null,
      scopes: ['read'],
      user: { id: 'user-3', deleted: false },
    });
    const insufficientScope = await requireUserApiKey(new Request('http://localhost/api/user/v1/projects', {
      headers: { authorization: 'Bearer ycu_read' },
    }), 'write');
    expect(insufficientScope.error?.status).toBe(403);
  });
});
