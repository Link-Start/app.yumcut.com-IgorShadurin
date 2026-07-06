import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  normalizeAdminApiIdempotencyKey,
  runIdempotentAdminApiOperation,
} from '@/server/admin/api-idempotency';
import { noStoreInit } from '@/server/admin/read-api';
import { normalizeEmail } from '@/server/emails/planned';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_EMAIL_LANGUAGE = 'en';

const adminEmailQueueSchema = z.object({
  userIds: z.array(z.string().trim().min(1).max(64)).min(1).max(500),
  subject: z.string().trim().min(1).max(512),
  text: z.string().trim().min(1).max(20_000),
  targetLanguage: z.string().trim().min(2).max(8).optional(),
});

type SkippedEmailRecipient = {
  userId: string;
  reason: 'duplicate' | 'invalid_user_id' | 'not_found' | 'deleted' | 'guest_user' | 'invalid_email';
};

function parseLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  const [primary] = normalized.split('-', 1);
  if (!primary || !/^[a-z]{2,8}$/.test(primary)) return null;
  return primary;
}

function normalizeRequestedUserIds(userIds: string[]) {
  const seen = new Set<string>();
  const validUserIds: string[] = [];
  const skipped: SkippedEmailRecipient[] = [];

  for (const rawUserId of userIds) {
    const userId = rawUserId.trim();
    if (!UUID_PATTERN.test(userId)) {
      skipped.push({ userId, reason: 'invalid_user_id' });
      continue;
    }
    if (seen.has(userId)) {
      skipped.push({ userId, reason: 'duplicate' });
      continue;
    }
    seen.add(userId);
    validUserIds.push(userId);
  }

  return { validUserIds, skipped };
}

function manualEmailKind(operationId: string) {
  return `admin_manual_${operationId}`;
}

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await requireAdminApiKey(req, 'write');
  if (!auth.context) return auth.error;

  const idempotencyKey = normalizeAdminApiIdempotencyKey(req);
  if (!idempotencyKey) {
    return error('VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
  }

  const json = await req.json().catch(() => null);
  const parsed = adminEmailQueueSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid email queue payload', 400, parsed.error.flatten());
  }

  const targetLanguageOverride = parseLanguage(parsed.data.targetLanguage);
  if (parsed.data.targetLanguage && !targetLanguageOverride) {
    return error('VALIDATION_ERROR', 'targetLanguage must be a valid language code', 400);
  }

  const normalizedRecipients = normalizeRequestedUserIds(parsed.data.userIds);
  const idempotent = await runIdempotentAdminApiOperation({
    auth: auth.context,
    idempotencyKey,
    action: 'emails.queue',
    body: {
      userIds: parsed.data.userIds,
      subject: parsed.data.subject,
      text: parsed.data.text,
      targetLanguage: targetLanguageOverride,
    },
    run: async (operation) => {
      const users = normalizedRecipients.validUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: normalizedRecipients.validUserIds } },
            select: {
              id: true,
              email: true,
              deleted: true,
              isGuest: true,
              preferredLanguage: true,
            },
          })
        : [];

      const usersById = new Map(users.map((user) => [user.id, user]));
      const skipped: SkippedEmailRecipient[] = [...normalizedRecipients.skipped];
      const scheduledAt = new Date();
      const kind = manualEmailKind(operation.id);
      const rows: Array<{
        userId: string;
        email: string;
        kind: string;
        subject: string;
        text: string;
        targetLanguage: string;
        scheduledAt: Date;
        status: string;
        metadata: Prisma.InputJsonValue;
      }> = [];

      for (const userId of normalizedRecipients.validUserIds) {
        const user = usersById.get(userId);
        if (!user) {
          skipped.push({ userId, reason: 'not_found' });
          continue;
        }
        if (user.deleted) {
          skipped.push({ userId, reason: 'deleted' });
          continue;
        }
        if (user.isGuest) {
          skipped.push({ userId, reason: 'guest_user' });
          continue;
        }
        const emailAddress = normalizeEmail(user.email);
        if (!emailAddress) {
          skipped.push({ userId, reason: 'invalid_email' });
          continue;
        }

        rows.push({
          userId,
          email: emailAddress,
          kind,
          subject: parsed.data.subject,
          text: parsed.data.text,
          targetLanguage: targetLanguageOverride ?? parseLanguage(user.preferredLanguage) ?? DEFAULT_EMAIL_LANGUAGE,
          scheduledAt,
          status: 'pending',
          metadata: {
            adminApi: {
              action: 'emails.queue',
              keyId: auth.context.keyId,
              keyName: auth.context.keyName,
              idempotencyKey,
              operationId: operation.id,
            },
          },
        });
      }

      const created = rows.length > 0
        ? await prisma.$transaction(rows.map((row) => prisma.plannedEmail.create({
            data: row,
            select: {
              id: true,
              userId: true,
              email: true,
              kind: true,
              scheduledAt: true,
            },
          })))
        : [];

      return {
        queued: created.length,
        skipped,
        items: created.map((item) => ({
          id: item.id,
          userId: item.userId,
          email: item.email,
          kind: item.kind,
          scheduledAt: item.scheduledAt.toISOString(),
        })),
        createdAt: scheduledAt.toISOString(),
      };
    },
  });

  if (idempotent.error) return idempotent.error;
  return ok({
    ...idempotent.result,
    idempotentReplay: idempotent.idempotentReplay,
  }, noStoreInit());
}, 'Failed to queue admin API emails');
