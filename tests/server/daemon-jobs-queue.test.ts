import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const assertDaemonAuth = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth', () => ({
  assertDaemonAuth,
}));

vi.mock('@/server/db', () => ({
  prisma: {
    job: { findMany },
  },
}));

describe('GET /api/daemon/jobs/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertDaemonAuth.mockResolvedValue('daemon-1');
    findMany.mockResolvedValue([]);
  });

  it('filters out deleted projects from queued jobs', async () => {
    const route = await import('@/app/api/daemon/jobs/queue/route');
    const req = new NextRequest('http://localhost/api/daemon/jobs/queue?limit=5');

    const res = await route.GET(req);
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.project.AND).toEqual(expect.arrayContaining([{ deleted: false }]));
  });
});

