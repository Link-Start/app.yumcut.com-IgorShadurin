import { forbidden, unauthorized } from '@/server/http';
import { prisma } from '@/server/db';
import {
  hashUserApiKeyToken,
  parseUserApiKeyScopes,
  type UserApiKeyScope,
} from '@/server/user-api/api-keys';

export type UserApiKeyAuthContext = {
  keyId: string;
  keyName: string;
  userId: string;
  scopes: UserApiKeyScope[];
  sessionUser: {
    id: string;
    email: string | null;
    name: string | null;
    isAdmin: boolean;
    preferredLanguage: string | null;
  };
};

export type UserApiKeyAuthResult =
  | { context: UserApiKeyAuthContext; error: null }
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

export async function requireUserApiKey(
  req: Request,
  requiredScope: UserApiKeyScope = 'read',
): Promise<UserApiKeyAuthResult> {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return { context: null, error: unauthorized('User API key required') };
  }

  const tokenHash = hashUserApiKeyToken(bearer);
  const row = await (prisma as any).userApiKey.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          deleted: true,
          preferredLanguage: true,
        },
      },
    },
  });

  if (!row || row.revokedAt) {
    return { context: null, error: unauthorized('Invalid user API key') };
  }

  if (!row.user || row.user.deleted) {
    return { context: null, error: forbidden('User API key owner is no longer active') };
  }

  const scopes = parseUserApiKeyScopes(row.scopes);
  if (!scopes.includes(requiredScope)) {
    return { context: null, error: forbidden('User API key scope is insufficient') };
  }

  await (prisma as any).userApiKey.update({
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
      userId: row.userId,
      scopes,
      sessionUser: {
        id: row.user.id,
        email: row.user.email ?? null,
        name: row.user.name ?? null,
        // User API keys must never unlock admin-only query paths on reused routes.
        isAdmin: false,
        preferredLanguage: row.user.preferredLanguage ?? null,
      },
    },
    error: null,
  };
}
