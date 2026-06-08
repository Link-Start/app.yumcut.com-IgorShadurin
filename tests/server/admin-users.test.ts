import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.hoisted(() => vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)));
const userFindMany = vi.hoisted(() => vi.fn());
const userCount = vi.hoisted(() => vi.fn());

vi.mock('@/server/db', () => ({
  prisma: {
    $transaction: transaction,
    user: {
      findMany: userFindMany,
      count: userCount,
    },
  },
}));

import { listUsers, searchUsersByEmailOrName } from '@/server/admin/users';

describe('admin users queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations));
    userFindMany.mockResolvedValue([]);
    userCount.mockResolvedValue(0);
  });

  it('listUsers excludes deleted accounts', async () => {
    await listUsers({ page: 1, pageSize: 20 });

    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    }));
    expect(userCount).toHaveBeenCalledWith({ where: { deleted: false } });
  });

  it('listUsers can include deleted accounts when requested', async () => {
    await listUsers({ page: 1, pageSize: 20, includeDeleted: true });

    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    }));
    expect(userFindMany).toHaveBeenCalledWith(expect.not.objectContaining({
      where: expect.anything(),
    }));
    expect(userCount).toHaveBeenCalledWith();
  });

  it('search excludes deleted accounts by default', async () => {
    await searchUsersByEmailOrName({ query: 'overlordpatil@gmail.com' });

    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          {
            OR: [
              { email: { contains: 'overlordpatil@gmail.com' } },
              { name: { contains: 'overlordpatil@gmail.com' } },
            ],
          },
          { deleted: false },
        ],
      },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('search can include deleted accounts when requested', async () => {
    await searchUsersByEmailOrName({ query: 'overlordpatil@gmail.com', includeDeleted: true });

    expect(userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { email: { contains: 'overlordpatil@gmail.com' } },
          { name: { contains: 'overlordpatil@gmail.com' } },
        ],
      },
    }));
  });
});
