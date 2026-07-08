import crypto from 'node:crypto';
import { prisma } from '@/server/db';

export type UserApiKeyScope = 'read' | 'write';

export type UserApiKeyListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: UserApiKeyScope[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  lastUsedUserAgent: string | null;
};

export type CreatedUserApiKey = {
  key: string;
  item: UserApiKeyListItem;
};

const USER_API_KEY_PREFIX = 'ycu_';
const DEFAULT_USER_API_KEY_SCOPES: UserApiKeyScope[] = ['read', 'write'];
const MAX_API_KEY_NAME_LENGTH = 120;

export function hashUserApiKeyToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function normalizeUserApiKeyName(value: unknown) {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : '';
  return normalized.slice(0, MAX_API_KEY_NAME_LENGTH);
}

export function parseUserApiKeyScopes(value: unknown): UserApiKeyScope[] {
  if (!Array.isArray(value)) return [];
  const scopes = new Set<UserApiKeyScope>();
  for (const entry of value) {
    if (entry === 'read' || entry === 'write') {
      scopes.add(entry);
    }
  }
  return Array.from(scopes);
}

function generatePlaintextKey() {
  return `${USER_API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function keyPrefixForDisplay(key: string) {
  return key.slice(0, 12);
}

function serializeUserApiKey(row: any): UserApiKeyListItem {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: parseUserApiKeyScopes(row.scopes),
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    lastUsedIp: row.lastUsedIp ?? null,
    lastUsedUserAgent: row.lastUsedUserAgent ?? null,
  };
}

export async function listUserApiKeys(userId: string): Promise<UserApiKeyListItem[]> {
  const rows = await (prisma as any).userApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeUserApiKey);
}

export async function createUserApiKey(input: {
  userId: string;
  name: string;
  scopes?: UserApiKeyScope[];
}): Promise<CreatedUserApiKey> {
  const name = normalizeUserApiKeyName(input.name);
  if (!name) {
    throw new Error('API key name is required');
  }

  const scopes = parseUserApiKeyScopes(input.scopes);
  const effectiveScopes = scopes.length > 0 ? scopes : DEFAULT_USER_API_KEY_SCOPES;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const key = generatePlaintextKey();
    const tokenHash = hashUserApiKeyToken(key);
    const tokenPrefix = keyPrefixForDisplay(key);
    try {
      const row = await (prisma as any).userApiKey.create({
        data: {
          userId: input.userId,
          name,
          tokenHash,
          tokenPrefix,
          scopes: effectiveScopes,
        },
      });
      return {
        key,
        item: serializeUserApiKey(row),
      };
    } catch (error: any) {
      if (error?.code !== 'P2002' || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Unable to generate API key');
}

export async function revokeUserApiKey(input: {
  userId: string;
  id: string;
}): Promise<UserApiKeyListItem | null> {
  const existing = await (prisma as any).userApiKey.findFirst({
    where: {
      id: input.id,
      userId: input.userId,
    },
  });
  if (!existing) return null;

  if (!existing.revokedAt) {
    await (prisma as any).userApiKey.update({
      where: { id: input.id },
      data: { revokedAt: new Date() },
    });
  }

  const updated = await (prisma as any).userApiKey.findFirst({
    where: {
      id: input.id,
      userId: input.userId,
    },
  });
  return updated ? serializeUserApiKey(updated) : null;
}
