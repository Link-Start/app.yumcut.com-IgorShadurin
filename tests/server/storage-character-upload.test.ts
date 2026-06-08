import { beforeEach, describe, expect, it, vi } from 'vitest';

const issueSignedDaemonUploadGrant = vi.hoisted(() => vi.fn());
const issueSignedStorageCommand = vi.hoisted(() => vi.fn());

vi.mock('@/lib/upload-signature', () => ({
  issueSignedDaemonUploadGrant,
  issueSignedStorageCommand,
}));

const storage = await import('@/server/storage');

describe('storage character asset uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_STORAGE_BASE_URL = 'https://storage.test';
    process.env.DAEMON_API_PASSWORD = 'daemon-secret';
    issueSignedDaemonUploadGrant.mockReturnValue({
      data: '{"grant":true}',
      signature: 'sig',
      payload: {},
    });
    issueSignedStorageCommand.mockReturnValue({
      data: '{"delete":true}',
      signature: 'delete-sig',
      payload: {},
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      path: 'characters/catalog/preview.mp4',
      url: 'https://storage.test/api/media/characters/catalog/preview.mp4',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
  });

  it('sends admin catalog files to storage characters endpoint with signed daemon grant', async () => {
    const result = await storage.uploadCharacterAssetToStorage({
      file: new File([new Uint8Array([1, 2, 3])], 'preview.mp4', { type: 'video/mp4' }),
      fileName: 'preview.mp4',
      kind: 'video',
    });

    expect(result).toEqual({
      path: 'characters/catalog/preview.mp4',
      url: 'https://storage.test/api/media/characters/catalog/preview.mp4',
    });
    expect(issueSignedDaemonUploadGrant).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'admin-character-catalog',
      kind: 'video',
      maxBytes: 3,
      mimeTypes: ['video/mp4'],
    }));
    expect(fetch).toHaveBeenCalledWith('https://storage.test/api/storage/characters', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'x-daemon-password': 'daemon-secret',
        'x-daemon-id': 'app-admin-character-catalog',
      }),
    }));
  });
});
