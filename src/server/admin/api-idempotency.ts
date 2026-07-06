import crypto from 'node:crypto';
import { prisma } from '@/server/db';
import { error } from '@/server/http';
import type { AdminApiKeyAuthContext } from '@/server/admin/api-auth';

const MAX_IDEMPOTENCY_KEY_LENGTH = 191;

export function normalizeAdminApiIdempotencyKey(req: Request) {
  const value = req.headers.get('idempotency-key')?.trim() ?? '';
  return value.length > 0 ? value.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH) : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function hashAdminApiOperationBody(value: unknown) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

export type AdminApiIdempotentOperationInput<T> = {
  auth: AdminApiKeyAuthContext;
  idempotencyKey: string;
  action: string;
  body: unknown;
  run: (operation: { id: string }) => Promise<T>;
};

export type AdminApiIdempotentOperationResult<T> =
  | { result: T; idempotentReplay: boolean; error: null }
  | { result: null; idempotentReplay: false; error: Response };

export async function runIdempotentAdminApiOperation<T extends Record<string, unknown>>(
  input: AdminApiIdempotentOperationInput<T>,
): Promise<AdminApiIdempotentOperationResult<T>> {
  const bodyHash = hashAdminApiOperationBody(input.body);
  const operationModel = (prisma as any).adminApiOperation;

  const existing = await operationModel.findUnique({
    where: {
      keyId_idempotencyKey: {
        keyId: input.auth.keyId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  if (existing) {
    if (existing.action !== input.action || existing.bodyHash !== bodyHash) {
      return {
        result: null,
        idempotentReplay: false,
        error: error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different request', 409),
      };
    }
    if (existing.result && typeof existing.result === 'object') {
      return {
        result: existing.result as T,
        idempotentReplay: true,
        error: null,
      };
    }
    return {
      result: null,
      idempotentReplay: false,
      error: error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key is already in progress or did not complete', 409),
    };
  }

  let operation: { id: string };
  try {
    operation = await operationModel.create({
      data: {
        keyId: input.auth.keyId,
        idempotencyKey: input.idempotencyKey,
        action: input.action,
        bodyHash,
      },
      select: { id: true },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return {
        result: null,
        idempotentReplay: false,
        error: error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key is already in progress', 409),
      };
    }
    throw err;
  }

  let result: T;
  try {
    result = await input.run(operation);
  } catch (err) {
    await operationModel.delete({ where: { id: operation.id } }).catch(() => null);
    throw err;
  }

  await operationModel.update({
    where: { id: operation.id },
    data: { result },
  });
  return { result, idempotentReplay: false, error: null };
}
