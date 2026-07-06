import { forbidden, unauthorized } from '@/server/http';
import { prisma } from '@/server/db';
import {
  hashAdminApiKeyToken,
  parseAdminApiKeyScopes,
  type AdminApiKeyScope,
} from '@/server/admin/api-keys';

export type AdminApiKeyAuthContext = {
  keyId: string;
  keyName: string;
  createdByUserId: string;
  scopes: AdminApiKeyScope[];
};

export type AdminApiKeyAuthResult =
  | { context: AdminApiKeyAuthContext; error: null }
  | { context: null; error: Response };

function extractBearerToken(req: Request): string | null {
  const raw = req.headers.get('authorization');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

function normalizeHeader(value: string | null, max: number) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized.slice(0, max) : null;
}

function getRequestIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0] ?? null;
  return normalizeHeader(forwarded ?? req.headers.get('x-real-ip'), 64);
}

export async function requireAdminApiKey(
  req: Request,
  requiredScope: AdminApiKeyScope = 'read',
): Promise<AdminApiKeyAuthResult> {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return { context: null, error: unauthorized('Admin API key required') };
  }

  const tokenHash = hashAdminApiKeyToken(bearer);
  const row = await (prisma as any).adminApiKey.findUnique({
    where: { tokenHash },
    include: {
      createdByUser: {
        select: { id: true, isAdmin: true, deleted: true },
      },
    },
  });

  if (!row || row.revokedAt) {
    return { context: null, error: unauthorized('Invalid admin API key') };
  }

  if (!row.createdByUser || row.createdByUser.deleted || !row.createdByUser.isAdmin) {
    return { context: null, error: forbidden('Admin API key owner is no longer active') };
  }

  const scopes = parseAdminApiKeyScopes(row.scopes);
  if (!scopes.includes(requiredScope)) {
    return { context: null, error: forbidden('Admin API key scope is insufficient') };
  }

  await (prisma as any).adminApiKey.update({
    where: { id: row.id },
    data: {
      lastUsedAt: new Date(),
      lastUsedIp: getRequestIp(req),
      lastUsedUserAgent: normalizeHeader(req.headers.get('user-agent'), 512),
    },
  });

  return {
    context: {
      keyId: row.id,
      keyName: row.name,
      createdByUserId: row.createdByUserId,
      scopes,
    },
    error: null,
  };
}
