import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiKey = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  adminApiOperation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  plannedEmail: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/server/admin/api-auth', () => ({
  requireAdminApiKey,
}));

vi.mock('@/server/db', () => ({
  prisma: prismaMock,
}));

const tokenRoute = await import('@/app/api/admin/v1/users/[userId]/tokens/route');
const emailsRoute = await import('@/app/api/admin/v1/emails/route');
const { hashAdminApiOperationBody } = await import('@/server/admin/api-idempotency');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_USER_ID = '22222222-2222-4222-8222-222222222222';
const THIRD_USER_ID = '33333333-3333-4333-8333-333333333333';
const FOURTH_USER_ID = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_USER_ID = '55555555-5555-4555-8555-555555555555';

function request(path: string, body: unknown, idempotencyKey = 'idem-1') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('admin v1 token and email write API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiKey.mockResolvedValue({
      context: {
        keyId: 'key-1',
        keyName: 'Write key',
        createdByUserId: 'admin-1',
        scopes: ['read', 'write'],
      },
      error: null,
    });
    prismaMock.adminApiOperation.findUnique.mockResolvedValue(null);
    prismaMock.adminApiOperation.create.mockResolvedValue({ id: 'operation-1' });
    prismaMock.adminApiOperation.update.mockResolvedValue({});
    prismaMock.adminApiOperation.delete.mockResolvedValue({});
  });

  it('requires a write-scoped key and idempotency key for token changes', async () => {
    const res = await tokenRoute.POST(
      request(`/api/admin/v1/users/${USER_ID}/tokens`, { amount: 10, message: 'bonus' }, ''),
      { params: Promise.resolve({ userId: USER_ID }) },
    );

    expect(res.status).toBe(400);
    expect(requireAdminApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'write');
    expect(prismaMock.adminApiOperation.create).not.toHaveBeenCalled();
  });

  it('adds tokens and writes an admin ledger transaction once', async () => {
    const createdAt = new Date('2026-07-06T10:00:00.000Z');
    const tx = {
      user: {
        update: vi.fn().mockResolvedValue({ tokenBalance: 150 }),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      tokenTransaction: {
        create: vi.fn().mockResolvedValue({ id: 'txn-1', createdAt }),
      },
    };
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, deleted: false });
    prismaMock.$transaction.mockImplementationOnce(async (callback: any) => callback(tx));

    const res = await tokenRoute.POST(
      request(`/api/admin/v1/users/${USER_ID}/tokens`, { amount: 50, message: 'manual credit' }, 'tokens-1'),
      { params: Promise.resolve({ userId: USER_ID }) },
    );

    expect(res.status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { tokenBalance: { increment: 50 } },
    }));
    expect(tx.tokenTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: USER_ID,
        delta: 50,
        balanceAfter: 150,
        type: 'ADMIN_ADJUSTMENT',
        description: 'manual credit',
        initiator: 'admin-api:key-1',
        metadata: expect.objectContaining({
          adminApi: expect.objectContaining({
            action: 'tokens.adjust',
            keyId: 'key-1',
          }),
        }),
      }),
    }));
    expect(prismaMock.adminApiOperation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'operation-1' },
      data: expect.objectContaining({
        result: expect.objectContaining({ transactionId: 'txn-1' }),
      }),
    }));
    await expect(res.json()).resolves.toMatchObject({
      userId: USER_ID,
      delta: 50,
      balanceAfter: 150,
      transactionId: 'txn-1',
      idempotentReplay: false,
    });
  });

  it('replays an existing token operation without touching the ledger', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, deleted: false });
    prismaMock.adminApiOperation.findUnique.mockResolvedValue({
      action: 'tokens.adjust',
      bodyHash: hashAdminApiOperationBody({
        userId: USER_ID,
        amount: 25,
        message: 'manual credit',
      }),
      result: {
        userId: USER_ID,
        delta: 25,
        balanceAfter: 125,
        transactionId: 'txn-existing',
        createdAt: '2026-07-06T10:00:00.000Z',
      },
    });

    const res = await tokenRoute.POST(
      request(`/api/admin/v1/users/${USER_ID}/tokens`, { amount: 25, message: 'manual credit' }, 'tokens-1'),
      { params: Promise.resolve({ userId: USER_ID }) },
    );

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.adminApiOperation.create).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      transactionId: 'txn-existing',
      idempotentReplay: true,
    });
  });

  it('rejects email queue requests without write scope', async () => {
    requireAdminApiKey.mockResolvedValueOnce({
      context: null,
      error: Response.json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 }),
    });

    const res = await emailsRoute.POST(request('/api/admin/v1/emails', {
      userIds: [USER_ID],
      subject: 'Notice',
      text: 'Body',
    }, 'email-1'));

    expect(res.status).toBe(403);
    expect(requireAdminApiKey).toHaveBeenCalledWith(expect.any(NextRequest), 'write');
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.plannedEmail.create).not.toHaveBeenCalled();
  });

  it('queues plain text emails for active users and reports skipped recipients', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: USER_ID, email: ' User@Example.com ', deleted: false, isGuest: false, preferredLanguage: 'ru-RU' },
      { id: SECOND_USER_ID, email: 'deleted@example.com', deleted: true, isGuest: false, preferredLanguage: 'en' },
      { id: THIRD_USER_ID, email: 'guest@guest.yumcut', deleted: false, isGuest: true, preferredLanguage: 'en' },
      { id: FOURTH_USER_ID, email: 'not-an-email', deleted: false, isGuest: false, preferredLanguage: 'en' },
    ]);
    prismaMock.plannedEmail.create.mockResolvedValue({
      id: 'planned-1',
      userId: USER_ID,
      email: 'user@example.com',
      kind: 'admin_manual_operation-1',
      scheduledAt: new Date('2026-07-06T10:00:00.000Z'),
    });
    prismaMock.$transaction.mockImplementationOnce(async (operations: Array<Promise<unknown>>) => Promise.all(operations));

    const res = await emailsRoute.POST(request('/api/admin/v1/emails', {
      userIds: [
        USER_ID,
        USER_ID,
        'bad-id',
        SECOND_USER_ID,
        THIRD_USER_ID,
        FOURTH_USER_ID,
        UNKNOWN_USER_ID,
      ],
      subject: 'Manual notice',
      text: 'Plain text message',
      targetLanguage: 'ru',
    }, 'email-1'));

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: {
          in: [USER_ID, SECOND_USER_ID, THIRD_USER_ID, FOURTH_USER_ID, UNKNOWN_USER_ID],
        },
      },
    }));
    expect(prismaMock.plannedEmail.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.plannedEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: USER_ID,
        email: 'user@example.com',
        kind: 'admin_manual_operation-1',
        subject: 'Manual notice',
        text: 'Plain text message',
        targetLanguage: 'ru',
        status: 'pending',
        metadata: expect.objectContaining({
          adminApi: expect.objectContaining({
            action: 'emails.queue',
            keyId: 'key-1',
            idempotencyKey: 'email-1',
          }),
        }),
      }),
    }));

    const body = await res.json();
    expect(body).toMatchObject({
      queued: 1,
      idempotentReplay: false,
      items: [
        {
          id: 'planned-1',
          userId: USER_ID,
          email: 'user@example.com',
          kind: 'admin_manual_operation-1',
        },
      ],
    });
    expect(body.skipped).toEqual(expect.arrayContaining([
      { userId: USER_ID, reason: 'duplicate' },
      { userId: 'bad-id', reason: 'invalid_user_id' },
      { userId: SECOND_USER_ID, reason: 'deleted' },
      { userId: THIRD_USER_ID, reason: 'guest_user' },
      { userId: FOURTH_USER_ID, reason: 'invalid_email' },
      { userId: UNKNOWN_USER_ID, reason: 'not_found' },
    ]));
  });

  it('replays queued email operations without creating duplicate planned emails', async () => {
    prismaMock.adminApiOperation.findUnique.mockResolvedValue({
      action: 'emails.queue',
      bodyHash: hashAdminApiOperationBody({
        userIds: [USER_ID],
        subject: 'Notice',
        text: 'Body',
        targetLanguage: null,
      }),
      result: {
        queued: 1,
        skipped: [],
        items: [{
          id: 'planned-existing',
          userId: USER_ID,
          email: 'user@example.com',
          kind: 'admin_manual_operation-1',
          scheduledAt: '2026-07-06T10:00:00.000Z',
        }],
        createdAt: '2026-07-06T10:00:00.000Z',
      },
    });

    const res = await emailsRoute.POST(request('/api/admin/v1/emails', {
      userIds: [USER_ID],
      subject: 'Notice',
      text: 'Body',
    }, 'email-1'));

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.plannedEmail.create).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      queued: 1,
      idempotentReplay: true,
      items: [{ id: 'planned-existing' }],
    });
  });
});
