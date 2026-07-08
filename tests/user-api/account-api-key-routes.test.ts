import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthSession = vi.hoisted(() => vi.fn());
const createUserApiKey = vi.hoisted(() => vi.fn());
const listUserApiKeys = vi.hoisted(() => vi.fn());
const revokeUserApiKey = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth', () => ({ getAuthSession }));
vi.mock('@/server/user-api/api-keys', () => ({
  createUserApiKey,
  listUserApiKeys,
  normalizeUserApiKeyName: (value: unknown) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''),
  revokeUserApiKey,
}));

const listRoute = await import('@/app/api/account/api-keys/route');
const itemRoute = await import('@/app/api/account/api-keys/[id]/route');

describe('session user API key management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ user: { id: 'user-1' } });
    listUserApiKeys.mockResolvedValue([
      {
        id: 'key-1',
        name: 'Automation',
        tokenPrefix: 'ycu_example',
        scopes: ['read', 'write'],
        createdAt: '2026-07-08T10:00:00.000Z',
        revokedAt: null,
        lastUsedAt: null,
        lastUsedIp: null,
        lastUsedUserAgent: null,
      },
    ]);
    createUserApiKey.mockResolvedValue({
      key: 'ycu_plaintext',
      item: {
        id: 'key-2',
        name: 'New key',
        tokenPrefix: 'ycu_new',
        scopes: ['read', 'write'],
        createdAt: '2026-07-08T11:00:00.000Z',
        revokedAt: null,
        lastUsedAt: null,
        lastUsedIp: null,
        lastUsedUserAgent: null,
      },
    });
    revokeUserApiKey.mockResolvedValue({
      id: 'key-1',
      name: 'Automation',
      tokenPrefix: 'ycu_example',
      scopes: ['read', 'write'],
      createdAt: '2026-07-08T10:00:00.000Z',
      revokedAt: '2026-07-08T12:00:00.000Z',
      lastUsedAt: null,
      lastUsedIp: null,
      lastUsedUserAgent: null,
    });
  });

  it('lists only keys owned by the signed-in session user', async () => {
    const res = await listRoute.GET();

    expect(res.status).toBe(200);
    expect(listUserApiKeys).toHaveBeenCalledWith('user-1');
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).not.toHaveProperty('tokenHash');
  });

  it('does not accept bearer API keys in place of a web session', async () => {
    getAuthSession.mockResolvedValue(null);

    const res = await listRoute.GET();

    expect(res.status).toBe(401);
    expect(listUserApiKeys).not.toHaveBeenCalled();
  });

  it('creates keys for the signed-in session user with explicit scopes', async () => {
    const res = await listRoute.POST(new Request('http://localhost/api/account/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  CI key  ', scopes: ['read'] }),
    }));

    expect(res.status).toBe(200);
    expect(createUserApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'CI key',
      scopes: ['read'],
    });
    const body = await res.json();
    expect(body.key).toBe('ycu_plaintext');
    expect(body.item).not.toHaveProperty('tokenHash');
  });

  it('rejects invalid create payloads before calling the key helper', async () => {
    const res = await listRoute.POST(new Request('http://localhost/api/account/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', scopes: ['admin'] }),
    }));

    expect(res.status).toBe(400);
    expect(createUserApiKey).not.toHaveBeenCalled();
  });

  it('revokes only a key belonging to the signed-in session user', async () => {
    const res = await itemRoute.DELETE(new Request('http://localhost/api/account/api-keys/key-1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'key-1' }) });

    expect(res.status).toBe(200);
    expect(revokeUserApiKey).toHaveBeenCalledWith({ userId: 'user-1', id: 'key-1' });
    const body = await res.json();
    expect(body.item.revokedAt).toBe('2026-07-08T12:00:00.000Z');
  });

  it('does not reveal whether another user key exists when revoke misses', async () => {
    revokeUserApiKey.mockResolvedValue(null);

    const res = await itemRoute.DELETE(new Request('http://localhost/api/account/api-keys/key-elsewhere', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'key-elsewhere' }) });

    expect(res.status).toBe(404);
    expect(revokeUserApiKey).toHaveBeenCalledWith({ userId: 'user-1', id: 'key-elsewhere' });
  });
});
