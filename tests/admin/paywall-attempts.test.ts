import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiSession = vi.hoisted(() => vi.fn());
const countAttempts = vi.hoisted(() => vi.fn());
const findManyAttempts = vi.hoisted(() => vi.fn());

vi.mock('@/server/admin', () => ({ requireAdminApiSession }));
vi.mock('@/server/db', () => ({
  prisma: {
    projectCreationAttempt: {
      count: countAttempts,
      findMany: findManyAttempts,
    },
  },
}));

const route = await import('@/app/api/admin/project-attempts/paywall/route');

const sampleAttempt = {
  id: 'attempt-1',
  userId: 'user-1',
  projectId: null,
  clientAttemptId: 'client-1',
  result: 'paywall_shown',
  promptText: 'Make a prank',
  promptMode: 'idea',
  projectExperience: 'image-generation',
  durationSeconds: null,
  tokenCost: 3,
  tokenBalance: 0,
  mainPageMode: 'image-prank',
  mainPageCategoryId: null,
  characterSlug: 'ava',
  templateId: null,
  utmSource: 'newsletter',
  utmMedium: null,
  utmCampaign: null,
  intent: null,
  sourceToolSlug: null,
  referrerOrigin: null,
  referrerPath: null,
  landingPath: '/',
  query: null,
  languageCodes: null,
  settingsSnapshot: null,
  rawContext: null,
  createdAt: new Date('2026-06-20T10:00:00.000Z'),
  updatedAt: new Date('2026-06-20T10:00:00.000Z'),
  user: {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    isAdmin: false,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
  },
};

describe('GET /api/admin/project-attempts/paywall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiSession.mockResolvedValue({ session: { user: { id: 'admin-1', isAdmin: true } } });
    countAttempts.mockResolvedValue(1);
    findManyAttempts.mockResolvedValue([sampleAttempt]);
  });

  it('lists paywall attempts with user info and page size controls', async () => {
    const res = await route.GET(new NextRequest('http://localhost/api/admin/project-attempts/paywall?pageSize=100&q=prank'));

    expect(res.status).toBe(200);
    expect(countAttempts).toHaveBeenCalledWith({
      where: expect.objectContaining({ result: 'paywall_shown' }),
    });
    expect(findManyAttempts).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: expect.objectContaining({ user: expect.any(Object) }),
    }));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      id: 'attempt-1',
      userId: 'user-1',
      promptText: 'Make a prank',
      user: { email: 'user@example.com', name: 'Test User' },
    });
  });

  it('exports JSON with date range in filename', async () => {
    const res = await route.GET(new NextRequest('http://localhost/api/admin/project-attempts/paywall?export=1&from=2026-06-01&to=2026-06-30'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('paywall-attempts_2026-06-01_2026-06-30.json');
    expect(findManyAttempts).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'asc' },
      take: 50_000,
    }));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].createdAt).toBe('2026-06-20T10:00:00.000Z');
  });
});
