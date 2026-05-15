import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error, ok } from '@/server/http';
import {
  AdminCharacterPreviewVideoProcessingError,
  deleteAdminCharacterPreviewVideo,
  uploadAdminCharacterPreviewVideo,
} from '@/server/admin/characters';

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
};

const VIDEO_EXT_WHITELIST = new Set(['mp4', 'webm', 'mov', 'm4v']);

function normalizeVideoExtension(file: File): string | null {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime && VIDEO_EXT_BY_MIME[mime]) return VIDEO_EXT_BY_MIME[mime];

  const fileName = (file.name || '').trim().toLowerCase();
  const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
  if (!ext) return null;
  return VIDEO_EXT_WHITELIST.has(ext) ? ext : null;
}

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  if (!id) return error('VALIDATION_ERROR', 'character id is required', 400);

  const form = await req.formData();
  const video = form.get('video');
  const hasAudioRaw = (form.get('hasAudio') || '').toString().trim().toLowerCase();
  const processVideoRaw = (form.get('processVideo') || '').toString().trim().toLowerCase();
  const hasAudio = hasAudioRaw ? hasAudioRaw === 'true' || hasAudioRaw === '1' : true;
  const processVideo = processVideoRaw ? processVideoRaw === 'true' || processVideoRaw === '1' : true;
  if (!(video instanceof File)) return error('VALIDATION_ERROR', 'video file is required', 400);
  if (video.size <= 0) return error('VALIDATION_ERROR', 'video file is empty', 400);

  const extension = normalizeVideoExtension(video);
  if (!extension) {
    return error('VALIDATION_ERROR', 'Unsupported video type. Use mp4, webm, mov, or m4v.', 400);
  }

  let result: { previewVideoUrl: string };
  try {
    result = await uploadAdminCharacterPreviewVideo({
      id,
      videoFile: video,
      extension,
      hasAudio,
      processVideo,
    });
  } catch (err) {
    if (err instanceof AdminCharacterPreviewVideoProcessingError) {
      return error('VALIDATION_ERROR', err.message, 400);
    }
    throw err;
  }

  return ok({ ok: true, previewVideoUrl: result.previewVideoUrl });
}, 'Failed to upload character preview video');

export const DELETE = withApiError(async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const { id } = await params;
  if (!id) return error('VALIDATION_ERROR', 'character id is required', 400);

  await deleteAdminCharacterPreviewVideo(id);
  return ok({ ok: true });
}, 'Failed to delete character preview video');
