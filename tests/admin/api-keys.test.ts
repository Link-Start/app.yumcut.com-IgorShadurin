import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminApiKeyCreate = vi.hoisted(() => vi.fn());
const adminApiKeyFindUnique = vi.hoisted(() => vi.fn());
const adminApiKeyUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    adminApiKey: {
      create: adminApiKeyCreate,
      findUnique: adminApiKeyFindUnique,
      update: adminApiKeyUpdate,
    },
  },
}));

const {
  createAdminApiKey,
  hashAdminApiKeyToken,
} = await import('@/server/admin/api-keys');
const { requireAdminApiKey } = await import('@/server/admin/api-auth');

const createdAt = new Date('2026-07-06T10:00:00.000Z');

describe('admin API keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiKeyUpdate.mockResolvedValue({});
    adminApiKeyCreate.mockImplementation(async ({ data }: any) => ({
      id: 'key-1',
      ...data,
      createdAt,
      revokedAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      lastUsedUserAgent: null,
      createdByUser: {
        id: data.createdByUserId,
        email: 'admin@example.com',
        name: 'Admin',
      },
      revokedByUser: null,
    }));
  });

  it('returns plaintext once and stores only a hash', async () => {
    const result = await createAdminApiKey({
      name: ' Analyst key ',
      createdByUserId: 'admin-1',
    });

    expect(result.key).toMatch(/^yca_/);
    expect(adminApiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Analyst key',
        tokenHash: expect.any(String),
        tokenPrefix: expect.stringMatching(/^yca_/),
        scopes: ['read'],
        createdByUserId: 'admin-1',
      }),
    }));
    const storedHash = adminApiKeyCreate.mock.calls[0]?.[0]?.data?.tokenHash;
    expect(storedHash).toBe(hashAdminApiKeyToken(result.key));
    expect(storedHash).not.toBe(result.key);
    expect(result.item).not.toHaveProperty('tokenHash');
  });

  it('authenticates active read keys and updates last-used metadata', async () => {
    adminApiKeyFindUnique.mockResolvedValue({
      id: 'key-1',
      name: 'Analyst key',
      createdByUserId: 'admin-1',
      revokedAt: null,
      scopes: ['read'],
      createdByUser: { id: 'admin-1', isAdmin: true, deleted: false },
    });
    const req = new Request('http://localhost/api/admin/v1/users', {
      headers: {
        authorization: 'Bearer yca_test',
        'user-agent': 'vitest',
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });

    const result = await requireAdminApiKey(req, 'read');

    expect(result.error).toBeNull();
    expect(result.context).toMatchObject({ keyId: 'key-1', createdByUserId: 'admin-1', scopes: ['read'] });
    expect(adminApiKeyFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: hashAdminApiKeyToken('yca_test') },
    }));
    expect(adminApiKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'key-1' },
      data: expect.objectContaining({
        lastUsedAt: expect.any(Date),
        lastUsedIp: '203.0.113.10',
        lastUsedUserAgent: 'vitest',
      }),
    }));
  });

  it('rejects missing, revoked, and demoted-owner keys', async () => {
    const missing = await requireAdminApiKey(new Request('http://localhost/api/admin/v1/users'), 'read');
    expect(missing.error?.status).toBe(401);

    adminApiKeyFindUnique.mockResolvedValueOnce({
      id: 'key-1',
      revokedAt: new Date(),
      scopes: ['read'],
      createdByUser: { id: 'admin-1', isAdmin: true, deleted: false },
    });
    const revoked = await requireAdminApiKey(new Request('http://localhost/api/admin/v1/users', {
      headers: { authorization: 'Bearer yca_revoked' },
    }), 'read');
    expect(revoked.error?.status).toBe(401);

    adminApiKeyFindUnique.mockResolvedValueOnce({
      id: 'key-2',
      name: 'Old key',
      createdByUserId: 'admin-2',
      revokedAt: null,
      scopes: ['read'],
      createdByUser: { id: 'admin-2', isAdmin: false, deleted: false },
    });
    const demoted = await requireAdminApiKey(new Request('http://localhost/api/admin/v1/users', {
      headers: { authorization: 'Bearer yca_demoted' },
    }), 'read');
    expect(demoted.error?.status).toBe(403);
  });
});
