import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/server/api-user';
import {
  getAccountLanguage,
  patchAccountLanguageSchema,
  updateAccountLanguage,
} from '@/server/account/language';
import { withApiError } from '@/server/errors';
import { error, ok, unauthorized } from '@/server/http';

export const GET = withApiError(async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const language = await getAccountLanguage(auth.userId);
  if (!language) return unauthorized();

  return ok({ language });
}, 'Failed to load mobile account language');

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const parsed = patchAccountLanguageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid account language payload', 400, parsed.error.flatten());
  }

  const language = await updateAccountLanguage(auth.userId, parsed.data.language);
  if (!language) return unauthorized();

  return ok({ language });
}, 'Failed to update mobile account language');
