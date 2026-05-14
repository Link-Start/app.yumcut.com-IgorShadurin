import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = {
  project: { findFirst: vi.fn() },
  job: { findFirst: vi.fn() },
};

vi.mock('@/server/db', () => ({ prisma: prismaMock }));
vi.mock('@/server/api-user', () => ({ authenticateApiRequest: vi.fn() }));

import { authenticateApiRequest } from '@/server/api-user';

describe('project video download api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({ userId: 'user-1', source: 'session' } as any);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('video-bytes', {
      status: 200,
      headers: { 'content-type': 'video/mp4', 'content-length': '11' },
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads the final video by default', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      title: 'Dogs',
      prompt: 'about dogs running outside',
      rawScript: null,
      finalVideoPath: null,
      finalVideoUrl: null,
      videos: [{ path: 'projects/project-1/video/final.mp4', publicUrl: 'https://cdn.test/final.mp4', variant: null }],
    });

    const route = await import('@/app/api/projects/[projectId]/video/download/route');
    const req = new NextRequest('http://localhost/api/projects/project-1/video/download?language=en');
    const res = await route.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) });

    expect(res.status).toBe(200);
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        videos: expect.objectContaining({
          where: { isFinal: true, languageCode: 'en' },
        }),
      }),
    }));
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.test/final.mp4', { cache: 'no-store' });
    expect(res.headers.get('content-disposition')).toContain('about dogs running outside - yumcut.com - project-1.mp4');
  });

  it('downloads raw video for character projects when requested', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      title: 'Dogs',
      prompt: 'about dogs running outside',
      rawScript: null,
      finalVideoPath: null,
      finalVideoUrl: null,
      videos: [{ path: 'projects/project-1/video/raw.mp4', publicUrl: 'https://cdn.test/raw.mp4', variant: 'raw' }],
    });
    prismaMock.job.findFirst.mockResolvedValue({ payload: { projectExperience: 'character' } });

    const route = await import('@/app/api/projects/[projectId]/video/download/route');
    const req = new NextRequest('http://localhost/api/projects/project-1/video/download?language=en&variant=raw');
    const res = await route.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) });

    expect(res.status).toBe(200);
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        videos: expect.objectContaining({
          where: { isFinal: false, variant: 'raw', languageCode: 'en' },
        }),
      }),
    }));
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.test/raw.mp4', { cache: 'no-store' });
    expect(res.headers.get('content-disposition')).toContain('about dogs running outside - yumcut.com - raw - project-1.mp4');
  });

  it('does not expose raw video downloads for non-character projects', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      title: 'Story',
      prompt: 'story prompt',
      rawScript: null,
      finalVideoPath: null,
      finalVideoUrl: null,
      videos: [{ path: 'projects/project-1/video/raw.mp4', publicUrl: 'https://cdn.test/raw.mp4', variant: 'raw' }],
    });
    prismaMock.job.findFirst.mockResolvedValue({ payload: { projectExperience: 'story' } });

    const route = await import('@/app/api/projects/[projectId]/video/download/route');
    const req = new NextRequest('http://localhost/api/projects/project-1/video/download?variant=raw');
    const res = await route.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) });

    expect(res.status).toBe(404);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
