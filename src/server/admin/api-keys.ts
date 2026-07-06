import crypto from 'node:crypto';
import { prisma } from '@/server/db';

export type AdminApiKeyScope = 'read' | 'write';

export type AdminApiKeyListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: AdminApiKeyScope[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  lastUsedUserAgent: string | null;
  createdBy: {
    id: string;
    email: string | null;
    name: string | null;
  };
  revokedBy: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
};

export type CreatedAdminApiKey = {
  key: string;
  item: AdminApiKeyListItem;
};

const ADMIN_API_KEY_PREFIX = 'yca_';
const DEFAULT_ADMIN_API_KEY_SCOPES: AdminApiKeyScope[] = ['read'];
const MAX_API_KEY_NAME_LENGTH = 120;

export function hashAdminApiKeyToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function normalizeAdminApiKeyName(value: unknown) {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : '';
  return normalized.slice(0, MAX_API_KEY_NAME_LENGTH);
}

export function parseAdminApiKeyScopes(value: unknown): AdminApiKeyScope[] {
  if (!Array.isArray(value)) return [];
  const scopes = new Set<AdminApiKeyScope>();
  for (const entry of value) {
    if (entry === 'read' || entry === 'write') {
      scopes.add(entry);
    }
  }
  return Array.from(scopes);
}

function generatePlaintextKey() {
  return `${ADMIN_API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function keyPrefixForDisplay(key: string) {
  return key.slice(0, 12);
}

function serializeAdminApiKey(row: any): AdminApiKeyListItem {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: parseAdminApiKeyScopes(row.scopes),
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    lastUsedIp: row.lastUsedIp ?? null,
    lastUsedUserAgent: row.lastUsedUserAgent ?? null,
    createdBy: {
      id: row.createdByUser?.id ?? row.createdByUserId,
      email: row.createdByUser?.email ?? null,
      name: row.createdByUser?.name ?? null,
    },
    revokedBy: row.revokedByUser
      ? {
          id: row.revokedByUser.id,
          email: row.revokedByUser.email ?? null,
          name: row.revokedByUser.name ?? null,
        }
      : null,
  };
}

const adminApiKeyInclude = {
  createdByUser: {
    select: { id: true, email: true, name: true },
  },
  revokedByUser: {
    select: { id: true, email: true, name: true },
  },
} as const;

export async function listAdminApiKeys(): Promise<AdminApiKeyListItem[]> {
  const rows = await (prisma as any).adminApiKey.findMany({
    orderBy: { createdAt: 'desc' },
    include: adminApiKeyInclude,
  });
  return rows.map(serializeAdminApiKey);
}

export async function createAdminApiKey(input: {
  name: string;
  createdByUserId: string;
  scopes?: AdminApiKeyScope[];
}): Promise<CreatedAdminApiKey> {
  const name = normalizeAdminApiKeyName(input.name);
  if (!name) {
    throw new Error('API key name is required');
  }
  const scopes = parseAdminApiKeyScopes(input.scopes);
  const effectiveScopes = scopes.length > 0 ? scopes : DEFAULT_ADMIN_API_KEY_SCOPES;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const key = generatePlaintextKey();
    const tokenHash = hashAdminApiKeyToken(key);
    const tokenPrefix = keyPrefixForDisplay(key);
    try {
      const row = await (prisma as any).adminApiKey.create({
        data: {
          name,
          tokenHash,
          tokenPrefix,
          scopes: effectiveScopes,
          createdByUserId: input.createdByUserId,
        },
        include: adminApiKeyInclude,
      });
      return {
        key,
        item: serializeAdminApiKey(row),
      };
    } catch (error: any) {
      if (error?.code !== 'P2002' || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Unable to generate API key');
}

export async function revokeAdminApiKey(input: {
  id: string;
  revokedByUserId: string;
}): Promise<AdminApiKeyListItem | null> {
  const existing = await (prisma as any).adminApiKey.findUnique({
    where: { id: input.id },
    include: adminApiKeyInclude,
  });
  if (!existing) return null;

  if (!existing.revokedAt) {
    await (prisma as any).adminApiKey.update({
      where: { id: input.id },
      data: {
        revokedAt: new Date(),
        revokedByUserId: input.revokedByUserId,
      },
    });
  }

  const updated = await (prisma as any).adminApiKey.findUnique({
    where: { id: input.id },
    include: adminApiKeyInclude,
  });
  return updated ? serializeAdminApiKey(updated) : null;
}
