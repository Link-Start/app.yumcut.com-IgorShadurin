import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ProjectStatus } from '@/shared/constants/status';

const authenticateApiRequest = vi.hoisted(() => vi.fn());
const findFirst = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const tx = vi.hoisted(() => vi.fn());

vi.mock('@/server/api-user', () => ({
  authenticateApiRequest,
}));

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findFirst, update },
    job: { updateMany },
    projectStatusHistory: { create },
    $transaction: tx,
  },
}));

describe('DELETE /api/projects/[projectId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateApiRequest.mockResolvedValue({ userId: 'user-1', source: 'session' });
    findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-1', deleted: false });
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 2 });
    create.mockResolvedValue({});
    tx.mockResolvedValue([]);
  });

  it('soft-deletes project and cancels/pause daemon work in one transaction', async () => {
    const route = await import('@/app/api/projects/[projectId]/route');
    const req = new NextRequest('http://localhost/api/projects/project-1', { method: 'DELETE' });

    const res = await route.DELETE(req, { params: Promise.resolve({ projectId: 'project-1' }) });
    expect(res.status).toBe(200);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'project-1', userId: 'user-1', deleted: false } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        status: ProjectStatus.Cancelled,
        deleted: true,
      }),
    }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', status: { in: ['queued', 'running'] } },
      data: { status: 'paused' },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'project-1',
        status: ProjectStatus.Cancelled,
      }),
    }));
    expect(tx).toHaveBeenCalledTimes(1);
  });

  it('returns unauthorized when auth is missing', async () => {
    authenticateApiRequest.mockResolvedValueOnce(null);
    const route = await import('@/app/api/projects/[projectId]/route');
    const req = new NextRequest('http://localhost/api/projects/project-1', { method: 'DELETE' });

    const res = await route.DELETE(req, { params: Promise.resolve({ projectId: 'project-1' }) });
    expect(res.status).toBe(401);
    expect(tx).not.toHaveBeenCalled();
  });
});

