import { z } from 'zod';
import { withApiError } from '@/server/errors';
import { ok, error as apiError } from '@/server/http';
import { requireAdminApiSession } from '@/server/admin';
import { getAdminEmailSettings, updateAdminEmailSettings } from '@/server/admin/emails';

const updateSchema = z
  .object({
    followUp24hEnabled: z.boolean().optional(),
    registrationEmailsEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => typeof value === 'boolean'), {
    message: 'No changes provided',
  });

export const GET = withApiError(async function GET() {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;
  const settings = await getAdminEmailSettings();
  return ok(settings satisfies import('@/shared/types').AdminEmailSettingsDTO);
}, 'Failed to load admin email settings');

export const PATCH = withApiError(async function PATCH(req: Request) {
  const { session, error } = await requireAdminApiSession();
  if (!session) return error;
  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json || {});
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', parsed.error.issues?.[0]?.message || 'Invalid payload', 400, parsed.error.flatten());
  }
  const updated = await updateAdminEmailSettings(parsed.data);
  return ok(updated satisfies import('@/shared/types').AdminEmailSettingsDTO);
}, 'Failed to update admin email settings');
