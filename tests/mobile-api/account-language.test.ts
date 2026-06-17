import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticateApiRequest = vi.hoisted(() => vi.fn());
const findUniqueUser = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());

vi.mock('@/server/api-user', () => ({
  authenticateApiRequest,
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findUnique: findUniqueUser,
      update: updateUser,
    },
  },
}));

const route = await import('@/app/api/mobile/account/language/route');

function makeRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/mobile/account/language', {
    method: body === undefined ? 'GET' : 'PATCH',
    headers: {
      authorization: 'Bearer test-token',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('/api/mobile/account/language', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    authenticateApiRequest.mockResolvedValue(null);

    const res = await route.GET(makeRequest());

    expect(res.status).toBe(401);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns the stored account language for mobile users', async () => {
    authenticateApiRequest.mockResolvedValue({ userId: 'user-1', source: 'mobile' });
    findUniqueUser.mockResolvedValue({ preferredLanguage: 'ru' });

    const res = await route.GET(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ language: 'ru' });
    expect(findUniqueUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { preferredLanguage: true },
    });
  });

  it('updates the same preferredLanguage used by web email preferences', async () => {
    authenticateApiRequest.mockResolvedValue({ userId: 'user-1', source: 'mobile' });
    findUniqueUser.mockResolvedValue({ id: 'user-1' });
    updateUser.mockResolvedValue({ preferredLanguage: 'en' });

    const res = await route.PATCH(makeRequest({ language: 'en' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ language: 'en' });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { preferredLanguage: 'en' },
      select: { preferredLanguage: true },
    });
  });

  it('rejects unsupported email languages', async () => {
    authenticateApiRequest.mockResolvedValue({ userId: 'user-1', source: 'mobile' });

    const res = await route.PATCH(makeRequest({ language: 'es' }));

    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
