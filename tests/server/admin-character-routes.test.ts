import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireAdminApiSession = vi.hoisted(() => vi.fn());
const listAdminCharacters = vi.hoisted(() => vi.fn());
const updateAdminCharacter = vi.hoisted(() => vi.fn());
const softDeleteAdminCharacter = vi.hoisted(() => vi.fn());
const softDeleteAdminCharacters = vi.hoisted(() => vi.fn());
const bulkSetAdminCharactersVisibility = vi.hoisted(() => vi.fn());
const getNextAdminCharacterPriority = vi.hoisted(() => vi.fn());
const listAdminCharacterCategories = vi.hoisted(() => vi.fn());
const createAdminCharacterCategory = vi.hoisted(() => vi.fn());
const updateAdminCharacterCategory = vi.hoisted(() => vi.fn());
const importAdminCharacter = vi.hoisted(() => vi.fn());
const uploadAdminCharacterPreviewVideo = vi.hoisted(() => vi.fn());
const deleteAdminCharacterPreviewVideo = vi.hoisted(() => vi.fn());
const isAdminCharacterSlugAvailable = vi.hoisted(() => vi.fn());
const precheckAdminCharacterImportRows = vi.hoisted(() => vi.fn());
const checkAdminCharacterPriorities = vi.hoisted(() => vi.fn());
const applyAdminCharacterPriorities = vi.hoisted(() => vi.fn());
const prismaQueryRawUnsafe = vi.hoisted(() => vi.fn());

vi.mock('@/server/admin', () => ({
  requireAdminApiSession,
}));

vi.mock('@/server/admin/characters', () => ({
  listAdminCharacters,
  updateAdminCharacter,
  softDeleteAdminCharacter,
  softDeleteAdminCharacters,
  bulkSetAdminCharactersVisibility,
  getNextAdminCharacterPriority,
  listAdminCharacterCategories,
  createAdminCharacterCategory,
  updateAdminCharacterCategory,
  importAdminCharacter,
  uploadAdminCharacterPreviewVideo,
  deleteAdminCharacterPreviewVideo,
  isAdminCharacterSlugAvailable,
  precheckAdminCharacterImportRows,
  checkAdminCharacterPriorities,
  applyAdminCharacterPriorities,
  slugify: (input: string) => input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    $queryRawUnsafe: prismaQueryRawUnsafe,
  },
}));

describe('admin character routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminApiSession.mockResolvedValue({
      session: { user: { id: 'admin-1', isAdmin: true } },
      error: null,
    });
    listAdminCharacters.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
    updateAdminCharacter.mockResolvedValue(undefined);
    softDeleteAdminCharacter.mockResolvedValue(undefined);
    softDeleteAdminCharacters.mockResolvedValue(0);
    bulkSetAdminCharactersVisibility.mockResolvedValue(0);
    getNextAdminCharacterPriority.mockResolvedValue({ highestPriority: 10, nextPriority: 11 });
    listAdminCharacterCategories.mockResolvedValue([]);
    createAdminCharacterCategory.mockResolvedValue({ id: 'cat-1', slug: 'brainrot', titleEn: 'Brainrot', titleRu: 'Brainrot', isActive: true, priority: 0 });
    updateAdminCharacterCategory.mockResolvedValue({ id: 'cat-1', slug: 'brainrot', titleEn: 'Brainrot', titleRu: 'Brainrot', isActive: true, priority: 0 });
    importAdminCharacter.mockResolvedValue({ status: 'saved', characterId: 'ch-1' });
    uploadAdminCharacterPreviewVideo.mockResolvedValue({ previewVideoUrl: '/characters/brainrot/creepy-comic/preview/preview.mp4' });
    deleteAdminCharacterPreviewVideo.mockResolvedValue(undefined);
    isAdminCharacterSlugAvailable.mockResolvedValue(true);
    precheckAdminCharacterImportRows.mockResolvedValue({ items: [] });
    checkAdminCharacterPriorities.mockResolvedValue({
      categoryId: 'cat-1',
      normalizedSlugs: ['a', 'b'],
      existingSlugs: ['a'],
      missingSlugs: ['b'],
      existingCount: 1,
      missingCount: 1,
    });
    applyAdminCharacterPriorities.mockResolvedValue({
      categoryId: 'cat-1',
      normalizedSlugs: ['a', 'b'],
      existingSlugs: ['a'],
      missingSlugs: ['b'],
      updatedCount: 12,
      totalInCategory: 12,
      highestPriority: 120,
      step: 10,
    });
    prismaQueryRawUnsafe.mockResolvedValue([]);
  });

  it('GET /api/admin/characters lists items', async () => {
    listAdminCharacters.mockResolvedValueOnce({ items: [{ id: 'ch-1' }], page: 2, pageSize: 10, total: 11, totalPages: 2 });
    const route = await import('@/app/api/admin/characters/route');
    const req = new NextRequest('http://localhost/api/admin/characters?q=creepy&categoryId=cat-1&page=2&pageSize=10');
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    expect(listAdminCharacters).toHaveBeenCalledWith({
      query: 'creepy',
      categoryId: 'cat-1',
      page: 2,
      pageSize: 10,
    });
  });

  it('PATCH /api/admin/characters/[id] updates item', async () => {
    const route = await import('@/app/api/admin/characters/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1', {
      method: 'PATCH',
      body: JSON.stringify({ slug: 'new-slug', isPublic: true, categoryId: 'cat-1', previewVideoHasAudio: false }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await route.PATCH(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(updateAdminCharacter).toHaveBeenCalledWith('ch-1', expect.objectContaining({ slug: 'new-slug', isPublic: true, categoryId: 'cat-1', previewVideoHasAudio: false }));
  });

  it('PATCH /api/admin/characters/[id] rejects empty category assignment', async () => {
    const route = await import('@/app/api/admin/characters/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1', {
      method: 'PATCH',
      body: JSON.stringify({ categoryId: null }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await route.PATCH(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(400);
    expect(updateAdminCharacter).not.toHaveBeenCalled();
  });

  it('DELETE /api/admin/characters/[id] deletes item from DB only by default', async () => {
    const route = await import('@/app/api/admin/characters/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1', { method: 'DELETE' });
    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(softDeleteAdminCharacter).toHaveBeenCalledWith('ch-1', false);
  });

  it('DELETE /api/admin/characters/[id] supports deleteFiles query', async () => {
    const route = await import('@/app/api/admin/characters/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1?deleteFiles=1', { method: 'DELETE' });
    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(softDeleteAdminCharacter).toHaveBeenCalledWith('ch-1', true);
  });

  it('POST /api/admin/characters/bulk-delete deletes multiple items from DB only by default', async () => {
    softDeleteAdminCharacters.mockResolvedValueOnce(3);
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1', 'ch-2', 'ch-3'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(softDeleteAdminCharacters).toHaveBeenCalledWith(['ch-1', 'ch-2', 'ch-3'], false);
  });

  it('POST /api/admin/characters/bulk-delete supports deleteFiles flag', async () => {
    softDeleteAdminCharacters.mockResolvedValueOnce(2);
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1', 'ch-2'], deleteFiles: true }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(softDeleteAdminCharacters).toHaveBeenCalledWith(['ch-1', 'ch-2'], true);
  });

  it('POST /api/admin/characters/bulk-delete returns 401 for unauthenticated', async () => {
    requireAdminApiSession.mockResolvedValueOnce({
      session: null,
      error: new Response(null, { status: 401 }),
    });
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(401);
    expect(softDeleteAdminCharacters).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/bulk-delete validates ids payload', async () => {
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: [] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(softDeleteAdminCharacters).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/bulk-delete returns 403 for non-admin', async () => {
    requireAdminApiSession.mockResolvedValueOnce({
      session: null,
      error: new Response(null, { status: 403 }),
    });
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(403);
    expect(softDeleteAdminCharacters).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/bulk-delete rejects cross-origin requests', async () => {
    const route = await import('@/app/api/admin/characters/bulk-delete/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1'] }),
      headers: {
        'content-type': 'application/json',
        origin: 'http://evil.example',
      },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(403);
    expect(softDeleteAdminCharacters).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/bulk-visibility updates selected visibility', async () => {
    bulkSetAdminCharactersVisibility.mockResolvedValueOnce(2);
    const route = await import('@/app/api/admin/characters/bulk-visibility/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-visibility', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1', 'ch-2'], isPublic: true }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(bulkSetAdminCharactersVisibility).toHaveBeenCalledWith(['ch-1', 'ch-2'], true);
  });

  it('POST /api/admin/characters/bulk-visibility validates isPublic', async () => {
    const route = await import('@/app/api/admin/characters/bulk-visibility/route');
    const req = new NextRequest('http://localhost/api/admin/characters/bulk-visibility', {
      method: 'POST',
      body: JSON.stringify({ ids: ['ch-1'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(bulkSetAdminCharactersVisibility).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/priorities/check validates payload', async () => {
    const route = await import('@/app/api/admin/characters/priorities/check/route');
    const req = new NextRequest('http://localhost/api/admin/characters/priorities/check', {
      method: 'POST',
      body: JSON.stringify({ categoryId: '', slugs: [] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(checkAdminCharacterPriorities).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/priorities/check returns category match stats', async () => {
    const route = await import('@/app/api/admin/characters/priorities/check/route');
    const req = new NextRequest('http://localhost/api/admin/characters/priorities/check', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cat-1', slugs: ['A', 'B', 'A'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(checkAdminCharacterPriorities).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      slugs: ['A', 'B', 'A'],
    });
  });

  it('POST /api/admin/characters/priorities/apply validates payload', async () => {
    const route = await import('@/app/api/admin/characters/priorities/apply/route');
    const req = new NextRequest('http://localhost/api/admin/characters/priorities/apply', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cat-1', slugs: [] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(applyAdminCharacterPriorities).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/priorities/apply applies reindex', async () => {
    const route = await import('@/app/api/admin/characters/priorities/apply/route');
    const req = new NextRequest('http://localhost/api/admin/characters/priorities/apply', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cat-1', slugs: ['z', 'b', 'x'] }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(applyAdminCharacterPriorities).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      slugs: ['z', 'b', 'x'],
    });
  });

  it('GET /api/admin/characters/next-priority returns next index', async () => {
    getNextAdminCharacterPriority.mockResolvedValueOnce({ highestPriority: 25, nextPriority: 26 });
    const route = await import('@/app/api/admin/characters/next-priority/route');
    const req = new NextRequest('http://localhost/api/admin/characters/next-priority?categoryId=cat-1');
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.highestPriority).toBe(25);
    expect(body.nextPriority).toBe(26);
    expect(getNextAdminCharacterPriority).toHaveBeenCalledWith('cat-1');
  });

  it('GET /api/admin/characters/next-priority validates categoryId', async () => {
    const route = await import('@/app/api/admin/characters/next-priority/route');
    const req = new NextRequest('http://localhost/api/admin/characters/next-priority');
    const res = await route.GET(req);
    expect(res.status).toBe(400);
    expect(getNextAdminCharacterPriority).not.toHaveBeenCalled();
  });

  it('POST /api/admin/character-categories validates payload', async () => {
    const route = await import('@/app/api/admin/character-categories/route');
    const req = new NextRequest('http://localhost/api/admin/character-categories', {
      method: 'POST',
      body: JSON.stringify({ title: 'No slug' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/character-categories creates category', async () => {
    const route = await import('@/app/api/admin/character-categories/route');
    const req = new NextRequest('http://localhost/api/admin/character-categories', {
      method: 'POST',
      body: JSON.stringify({ slug: 'brainrot', title: 'Brainrot' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(201);
    expect(createAdminCharacterCategory).toHaveBeenCalledWith(expect.objectContaining({ slug: 'brainrot', title: 'Brainrot' }));
  });

  it('PATCH /api/admin/character-categories/[id] updates category', async () => {
    const route = await import('@/app/api/admin/character-categories/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/character-categories/cat-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.PATCH(req, { params: Promise.resolve({ id: 'cat-1' }) });
    expect(res.status).toBe(200);
    expect(updateAdminCharacterCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({ title: 'Updated' }));
  });

  it('POST /api/admin/characters/import validates required files', async () => {
    const route = await import('@/app/api/admin/characters/import/route');
    const fd = new FormData();
    fd.set('categoryId', 'cat-1');
    fd.set('slug', 'creepy-comic');
    fd.set('name', 'Creepy Comic');
    fd.set('title', 'Creepy Comic');
    const req = new NextRequest('http://localhost/api/admin/characters/import', {
      method: 'POST',
      body: fd,
    });

    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(importAdminCharacter).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/import imports row', async () => {
    const route = await import('@/app/api/admin/characters/import/route');
    const validImageBytes = new Uint8Array(12 * 1024);
    const fd = new FormData();
    fd.set('categoryId', 'cat-1');
    fd.set('slug', 'creepy-comic');
    fd.set('name', 'Creepy Comic');
    fd.set('title', 'Creepy Comic');
    fd.set('isPublic', 'false');
    fd.set('prepared', new File([validImageBytes], 'prepared.webp', { type: 'image/webp' }));
    fd.set('empty', new File([validImageBytes], 'empty.webp', { type: 'image/webp' }));

    const req = new NextRequest('http://localhost/api/admin/characters/import', {
      method: 'POST',
      body: fd,
    });

    const res = await route.POST(req);
    expect(res.status).toBe(200);
    expect(importAdminCharacter).toHaveBeenCalledTimes(1);
  });

  it('GET /api/admin/characters/import/validation returns effective limits', async () => {
    prismaQueryRawUnsafe.mockResolvedValueOnce([
      { tableName: 'Character', maxLength: 191 },
      { tableName: 'CharacterVariation', maxLength: 191 },
    ]);
    const route = await import('@/app/api/admin/characters/import/validation/route');
    const req = new NextRequest('http://localhost/api/admin/characters/import/validation');
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limits.bioMax).toBe(191);
    expect(body.limits.fileMinBytes).toBe(10 * 1024);
    expect(body.limits.fileMaxBytes).toBe(10 * 1024 * 1024);
  });

  it('GET /api/admin/characters/import/validation falls back to defaults when schema lengths are missing', async () => {
    prismaQueryRawUnsafe.mockResolvedValueOnce([
      { tableName: 'Character', columnName: 'bio', maxLength: null },
    ]);
    const route = await import('@/app/api/admin/characters/import/validation/route');
    const req = new NextRequest('http://localhost/api/admin/characters/import/validation');
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limits.bioMax).toBe(300);
    expect(prismaQueryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("COLUMN_NAME IN ('description', 'bio')"));
  });

  it('POST /api/admin/characters/import/precheck validates max 100 rows', async () => {
    const route = await import('@/app/api/admin/characters/import/precheck/route');
    const req = new NextRequest('http://localhost/api/admin/characters/import/precheck', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: 'cat-1',
        rows: Array.from({ length: 101 }).map((_, idx) => ({
          key: `row-${idx}`,
          slug: `char-${idx}`,
          name: `Char ${idx}`,
          title: `Char ${idx}`,
          bio: '',
        })),
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(400);
    expect(precheckAdminCharacterImportRows).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/import/precheck returns per-row issues', async () => {
    precheckAdminCharacterImportRows.mockResolvedValueOnce({
      items: [{ key: 'row-1', issues: [{ field: 'slug', message: 'slug already exists' }] }],
    });
    const route = await import('@/app/api/admin/characters/import/precheck/route');
    const req = new NextRequest('http://localhost/api/admin/characters/import/precheck', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: 'cat-1',
        rows: [{
          key: 'row-1',
          slug: 'char-1',
          name: 'Char 1',
          title: 'Char 1',
          bio: '',
        }],
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await route.POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].issues[0].message).toContain('already exists');
    expect(precheckAdminCharacterImportRows).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      rows: [{
        key: 'row-1',
        slug: 'char-1',
        name: 'Char 1',
        title: 'Char 1',
        bio: '',
      }],
    });
  });

  it('POST /api/admin/characters/[id]/video validates file', async () => {
    const route = await import('@/app/api/admin/characters/[id]/video/route');
    const fd = new FormData();
    fd.set('video', new File([new Uint8Array([1, 2, 3])], 'preview.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1/video', {
      method: 'POST',
      body: fd,
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(400);
    expect(uploadAdminCharacterPreviewVideo).not.toHaveBeenCalled();
  });

  it('POST /api/admin/characters/[id]/video uploads preview', async () => {
    const route = await import('@/app/api/admin/characters/[id]/video/route');
    const fd = new FormData();
    fd.set('video', new File([new Uint8Array([1, 2, 3])], 'preview.mp4', { type: 'video/mp4' }));
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1/video', {
      method: 'POST',
      body: fd,
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(uploadAdminCharacterPreviewVideo).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ch-1',
      extension: 'mp4',
      hasAudio: true,
    }));
  });

  it('POST /api/admin/characters/[id]/video uploads preview with audio disabled', async () => {
    const route = await import('@/app/api/admin/characters/[id]/video/route');
    const fd = new FormData();
    fd.set('video', new File([new Uint8Array([1, 2, 3])], 'preview.mp4', { type: 'video/mp4' }));
    fd.set('hasAudio', 'false');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1/video', {
      method: 'POST',
      body: fd,
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(uploadAdminCharacterPreviewVideo).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ch-1',
      extension: 'mp4',
      hasAudio: false,
    }));
  });

  it('DELETE /api/admin/characters/[id]/video removes preview', async () => {
    const route = await import('@/app/api/admin/characters/[id]/video/route');
    const req = new NextRequest('http://localhost/api/admin/characters/ch-1/video', { method: 'DELETE' });
    const res = await route.DELETE(req, { params: Promise.resolve({ id: 'ch-1' }) });
    expect(res.status).toBe(200);
    expect(deleteAdminCharacterPreviewVideo).toHaveBeenCalledWith('ch-1');
  });

  it('GET /api/admin/characters/slug-availability validates slug', async () => {
    const route = await import('@/app/api/admin/characters/slug-availability/route');
    const req = new NextRequest('http://localhost/api/admin/characters/slug-availability?categoryId=cat-1');
    const res = await route.GET(req);
    expect(res.status).toBe(400);
    expect(isAdminCharacterSlugAvailable).not.toHaveBeenCalled();
  });

  it('GET /api/admin/characters/slug-availability checks availability', async () => {
    isAdminCharacterSlugAvailable.mockResolvedValueOnce(false);
    const route = await import('@/app/api/admin/characters/slug-availability/route');
    const req = new NextRequest('http://localhost/api/admin/characters/slug-availability?slug=Creepy+Comic&categoryId=cat-1&excludeId=ch-1');
    const res = await route.GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.available).toBe(false);
    expect(body.normalizedSlug).toBe('creepy-comic');
    expect(isAdminCharacterSlugAvailable).toHaveBeenCalledWith({
      slug: 'creepy-comic',
      categoryId: 'cat-1',
      excludeCharacterId: 'ch-1',
    });
  });
});
