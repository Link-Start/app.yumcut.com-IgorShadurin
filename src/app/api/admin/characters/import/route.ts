import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { error, ok } from '@/server/http';
import { importAdminCharacter } from '@/server/admin/characters';
import {
  ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS,
  validateAdminCharacterImportRow,
} from '@/shared/validators/admin-character-import';

export const POST = withApiError(async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const form = await req.formData();
  const categoryId = (form.get('categoryId') || '').toString().trim();
  const slug = (form.get('slug') || '').toString().trim();
  const name = (form.get('name') || '').toString().trim();
  const title = (form.get('title') || '').toString().trim();
  const bioRaw = form.get('bio');
  const bio = typeof bioRaw === 'string' ? bioRaw.trim() : '';
  const isPublicRaw = (form.get('isPublic') || '').toString().trim().toLowerCase();
  const prepared = form.get('prepared');
  const empty = form.get('empty');

  if (!categoryId) return error('VALIDATION_ERROR', 'categoryId is required', 400);
  if (!(prepared instanceof File)) return error('VALIDATION_ERROR', 'prepared file is required', 400);
  if (!(empty instanceof File)) return error('VALIDATION_ERROR', 'empty file is required', 400);

  const rowValidation = validateAdminCharacterImportRow({
    slug,
    name: name || title,
    title,
    bio,
    preparedFile: {
      name: prepared.name || 'prepared.webp',
      size: prepared.size,
      type: prepared.type,
    },
    emptyFile: {
      name: empty.name || 'empty.webp',
      size: empty.size,
      type: empty.type,
    },
  }, ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS);

  if (rowValidation.issues.length > 0) {
    return error('VALIDATION_ERROR', rowValidation.issues[0]?.message || 'Invalid import row', 400, {
      issues: rowValidation.issues,
      fieldErrors: rowValidation.fieldErrors,
    });
  }

  const result = await importAdminCharacter({
    categoryId,
    slug: rowValidation.normalized.slug,
    name: rowValidation.normalized.name || rowValidation.normalized.title,
    title: rowValidation.normalized.title,
    bio: rowValidation.normalized.bio || null,
    isPublic: isPublicRaw === 'true' || isPublicRaw === '1',
    preparedFile: prepared,
    emptyFile: empty,
  });

  return ok(result);
}, 'Failed to import character');
