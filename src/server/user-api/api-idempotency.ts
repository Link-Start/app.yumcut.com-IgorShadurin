import crypto from 'node:crypto';
import { prisma } from '@/server/db';
import { error } from '@/server/http';
import type { UserApiKeyAuthContext } from '@/server/user-api/api-auth';

const MAX_IDEMPOTENCY_KEY_LENGTH = 191;

type StoredResponse = {
  status: number;
  body: unknown;
};

export function normalizeUserApiIdempotencyKey(req: Request) {
  const value = req.headers.get('idempotency-key')?.trim() ?? '';
  return value.length > 0 ? value.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH) : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function hashUserApiOperationBody(value: unknown) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function isStoredResponse(value: unknown): value is StoredResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as StoredResponse).status === 'number' &&
      Object.prototype.hasOwnProperty.call(value, 'body'),
  );
}

function replayResponse(value: StoredResponse) {
  return Response.json(value.body, {
    status: value.status,
    headers: {
      'cache-control': 'no-store',
      'x-idempotent-replay': 'true',
    },
  });
}

export async function runIdempotentUserApiOperation(input: {
  auth: UserApiKeyAuthContext;
  idempotencyKey: string;
  action: string;
  body: unknown;
  run: (operation: { id: string }) => Promise<Response>;
}) {
  const bodyHash = hashUserApiOperationBody(input.body);
  const operationModel = (prisma as any).userApiOperation;

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
      return error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different request', 409);
    }
    if (isStoredResponse(existing.result)) {
      return replayResponse(existing.result);
    }
    return error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key is already in progress or did not complete', 409);
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
      return error('IDEMPOTENCY_CONFLICT', 'Idempotency-Key is already in progress', 409);
    }
    throw err;
  }

  let response: Response;
  try {
    response = await input.run(operation);
  } catch (err) {
    await operationModel.delete({ where: { id: operation.id } }).catch(() => null);
    throw err;
  }

  if (!response.ok) {
    await operationModel.delete({ where: { id: operation.id } }).catch(() => null);
    return response;
  }

  const body = await response.clone().json().catch(() => ({}));
  await operationModel.update({
    where: { id: operation.id },
    data: {
      result: {
        status: response.status,
        body,
      },
    },
  });

  return response;
}
