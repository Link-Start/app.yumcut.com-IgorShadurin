import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { withApiError } from '@/server/errors';
import { error, notFound, ok } from '@/server/http';
import { requireAdminApiKey } from '@/server/admin/api-auth';
import {
  normalizeAdminApiIdempotencyKey,
  runIdempotentAdminApiOperation,
} from '@/server/admin/api-idempotency';
import {
  InsufficientTokensError,
  TOKEN_TRANSACTION_TYPES,
} from '@/server/tokens';
import { noStoreInit } from '@/server/admin/read-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { userId: string };

const tokenAdjustmentSchema = z.object({
  amount: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, 'Amount must be non-zero'),
  message: z.string().trim().min(1).max(512),
});

function adminApiInitiator(keyId: string) {
  return `admin-api:${keyId}`;
}

export const POST = withApiError(async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireAdminApiKey(req, 'write');
  if (!auth.context) return auth.error;

  const idempotencyKey = normalizeAdminApiIdempotencyKey(req);
  if (!idempotencyKey) {
    return error('VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
  }

  const { userId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = tokenAdjustmentSchema.safeParse(json);
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid token adjustment payload', 400, parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deleted: true },
  });
  if (!user || user.deleted) return notFound('User not found');

  const idempotent = await runIdempotentAdminApiOperation({
    auth: auth.context,
    idempotencyKey,
    action: 'tokens.adjust',
    body: { userId, ...parsed.data },
    run: async () => {
      const amount = parsed.data.amount;
      const description = parsed.data.message;
      const metadata = {
        adminApi: {
          action: 'tokens.adjust',
          keyId: auth.context.keyId,
          keyName: auth.context.keyName,
          idempotencyKey,
        },
      };

      const adjusted = await prisma.$transaction(async (tx) => {
        if (amount > 0) {
          const updated = await tx.user.update({
            where: { id: userId },
            data: { tokenBalance: { increment: amount } },
            select: { tokenBalance: true },
          });
          const transaction = await tx.tokenTransaction.create({
            data: {
              userId,
              delta: amount,
              balanceAfter: updated.tokenBalance,
              type: TOKEN_TRANSACTION_TYPES.adminAdjustment,
              description,
              initiator: adminApiInitiator(auth.context.keyId),
              metadata,
            },
            select: { id: true, createdAt: true },
          });
          return {
            balanceAfter: updated.tokenBalance,
            transaction,
          };
        }

        const debit = Math.abs(amount);
        const updated = await tx.user.updateMany({
          where: { id: userId, tokenBalance: { gte: debit } },
          data: { tokenBalance: { decrement: debit } },
        });
        if (updated.count === 0) {
          const current = await tx.user.findUnique({
            where: { id: userId },
            select: { tokenBalance: true },
          });
          throw new InsufficientTokensError(current?.tokenBalance ?? 0, debit);
        }
        const after = await tx.user.findUnique({
          where: { id: userId },
          select: { tokenBalance: true },
        });
        const balanceAfter = after?.tokenBalance ?? 0;
        const transaction = await tx.tokenTransaction.create({
          data: {
            userId,
            delta: amount,
            balanceAfter,
            type: TOKEN_TRANSACTION_TYPES.adminAdjustment,
            description,
            initiator: adminApiInitiator(auth.context.keyId),
            metadata,
          },
          select: { id: true, createdAt: true },
        });
        return {
          balanceAfter,
          transaction,
        };
      });

      return {
        userId,
        delta: parsed.data.amount,
        balanceAfter: adjusted.balanceAfter,
        transactionId: adjusted.transaction.id,
        createdAt: adjusted.transaction.createdAt.toISOString(),
      };
    },
  });

  if (idempotent.error) return idempotent.error;
  return ok({
    ...idempotent.result,
    idempotentReplay: idempotent.idempotentReplay,
  }, noStoreInit());
}, 'Failed to adjust tokens via admin API');
