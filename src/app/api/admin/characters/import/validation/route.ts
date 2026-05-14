import { NextRequest } from 'next/server';
import { withApiError } from '@/server/errors';
import { requireAdminApiSession } from '@/server/admin';
import { ok } from '@/server/http';
import { ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS } from '@/shared/validators/admin-character-import';
import { prisma } from '@/server/db';

function toNumberSafe(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function resolveActiveBioMax(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ tableName: string; columnName: string; maxLength: unknown }>>(
      `
        SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, CHARACTER_MAXIMUM_LENGTH AS maxLength
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND (
            (TABLE_NAME = 'Character' AND COLUMN_NAME IN ('description', 'bio'))
            OR (TABLE_NAME = 'CharacterVariation' AND COLUMN_NAME = 'description')
          )
      `,
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const values = rows
      .map((row) => toNumberSafe(row.maxLength))
      .filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return null;
    return Math.min(...values);
  } catch {
    return null;
  }
}

export const GET = withApiError(async function GET(_req: NextRequest) {
  const { session, error: authError } = await requireAdminApiSession();
  if (!session) return authError;

  const dbBioMax = await resolveActiveBioMax();
  return ok({
    limits: {
      ...ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS,
      bioMax: dbBioMax ?? ADMIN_CHARACTER_IMPORT_VALIDATION_LIMITS.bioMax,
    },
  });
}, 'Failed to load import validation limits');
