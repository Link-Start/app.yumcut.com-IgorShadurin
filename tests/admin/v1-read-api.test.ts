import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiKey = vi.hoisted(() => vi.fn());
const userFindMany = vi.hoisted(() => vi.fn());
const attemptFindMany = vi.hoisted(() => vi.fn());
const feedbackFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/server/admin/api-auth', () => ({
  requireAdminApiKey,
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: {
      findMany: userFindMany,
    },
    projectCreationAttempt: {
      findMany: attemptFindMany,
    },
    inboundFeedback: {
      findMany: feedbackFindMany,
    },
  },
}));

const usersRoute = await import('@/app/api/admin/v1/users/route');
const attemptsRoute = await import('@/app/api/admin/v1/project-attempts/route');
const feedbacksRoute = await import('@/app/api/admin/v1/feedbacks/route');

describe('admin v1 read API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiKey.mockResolvedValue({
      context: {
        keyId: 'key-1',
        keyName: 'Test key',
        createdByUserId: 'admin-1',
        scopes: ['read'],
      },
      error: null,
    });
  });

  it('lists users with default limit and default fields', async () => {
    userFindMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        image: 'https://example.com/avatar.png',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        preferredLanguage: 'en',
        tokenBalance: 12,
        isAdmin: false,
        isGuest: false,
        deleted: false,
        deletedAt: null,
        emailReplyBonusGrantedAt: null,
        emailReplyBonusSourceId: null,
        subscriptionWinbackBonusPending: false,
        subscriptionWinbackBonusGrantedAt: null,
        _count: { projects: 3 },
      },
    ]);

    const res = await usersRoute.GET(new NextRequest('http://localhost/api/admin/v1/users'));
    expect(res.status).toBe(200);
    expect(requireAdminApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'read');
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));

    const body = await res.json();
    expect(body.limit).toBe(50);
    expect(body.nextCursor).toBeNull();
    expect(body.items[0]).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      createdAt: '2026-07-01T00:00:00.000Z',
      tokenBalance: 12,
      isAdmin: false,
      deleted: false,
      projectCount: 3,
    });
    expect(body.items[0]).not.toHaveProperty('image');
  });

  it('supports custom fields and rejects unknown fields', async () => {
    userFindMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        name: null,
        image: 'https://example.com/avatar.png',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        preferredLanguage: 'en',
        tokenBalance: 0,
        isAdmin: false,
        isGuest: false,
        deleted: false,
        deletedAt: null,
        emailReplyBonusGrantedAt: null,
        emailReplyBonusSourceId: null,
        subscriptionWinbackBonusPending: false,
        subscriptionWinbackBonusGrantedAt: null,
        _count: { projects: 0 },
      },
    ]);

    const custom = await usersRoute.GET(new NextRequest('http://localhost/api/admin/v1/users?fields=id,email,image&limit=1'));
    expect(custom.status).toBe(200);
    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    await expect(custom.json()).resolves.toMatchObject({
      items: [{ id: 'user-1', email: 'user@example.com', image: 'https://example.com/avatar.png' }],
      limit: 1,
    });

    userFindMany.mockClear();
    const invalid = await usersRoute.GET(new NextRequest('http://localhost/api/admin/v1/users?fields=id,passwordHash'));
    expect(invalid.status).toBe(400);
    expect(userFindMany).not.toHaveBeenCalled();
    const invalidBody = await invalid.json();
    expect(invalidBody.error.message).toContain('passwordHash');
  });

  it('lists project attempts including before-paywall input data', async () => {
    attemptFindMany.mockResolvedValue([
      {
        id: 'attempt-1',
        userId: 'user-1',
        projectId: null,
        clientAttemptId: 'client-1',
        result: 'paywall_shown',
        promptText: 'make a prank',
        promptMode: 'idea',
        projectExperience: 'image-generation',
        durationSeconds: null,
        tokenCost: 3,
        tokenBalance: 0,
        mainPageMode: 'image-prank',
        mainPageCategoryId: null,
        characterSlug: 'ava',
        templateId: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        intent: null,
        sourceToolSlug: null,
        referrerOrigin: null,
        referrerPath: null,
        landingPath: '/',
        query: { plan: 'weekly' },
        languageCodes: null,
        languageVoices: null,
        settingsSnapshot: null,
        rawContext: null,
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        updatedAt: new Date('2026-07-02T00:00:00.000Z'),
        user: { id: 'user-1', email: 'user@example.com', name: 'User', isAdmin: false, createdAt: new Date('2026-07-01T00:00:00.000Z') },
      },
    ]);

    const res = await attemptsRoute.GET(new NextRequest('http://localhost/api/admin/v1/project-attempts?result=paywall_shown&q=prank'));
    expect(res.status).toBe(200);
    expect(attemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 51,
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { result: 'paywall_shown' },
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    }));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      id: 'attempt-1',
      result: 'paywall_shown',
      promptText: 'make a prank',
      user: { email: 'user@example.com' },
    });
  });

  it('lists persisted feedbacks', async () => {
    feedbackFindMany.mockResolvedValue([
      {
        id: 'feedback-1',
        emailId: 'email-1',
        fromEmail: 'sender@example.com',
        fromRaw: 'Sender <sender@example.com>',
        toRecipients: ['support@app.yumcut.com'],
        subject: 'Help',
        latestReplyText: 'I could not finish the project',
        snippetSource: 'api',
        userId: 'user-1',
        replyBonus: { granted: true },
        inboundFetchError: null,
        telegramForwardError: null,
        enriched: true,
        forwardedToTelegram: true,
        createdAt: new Date('2026-07-03T00:00:00.000Z'),
        updatedAt: new Date('2026-07-03T00:00:00.000Z'),
        user: { id: 'user-1', email: 'user@example.com', name: 'User', isAdmin: false },
      },
    ]);

    const res = await feedbacksRoute.GET(new NextRequest('http://localhost/api/admin/v1/feedbacks?q=finish'));
    expect(res.status).toBe(200);
    expect(feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
    const body = await res.json();
    expect(body.items[0]).toEqual({
      id: 'feedback-1',
      emailId: 'email-1',
      fromEmail: 'sender@example.com',
      subject: 'Help',
      latestReplyText: 'I could not finish the project',
      snippetSource: 'api',
      userId: 'user-1',
      createdAt: '2026-07-03T00:00:00.000Z',
      user: { id: 'user-1', email: 'user@example.com', name: 'User', isAdmin: false },
    });
  });
});
