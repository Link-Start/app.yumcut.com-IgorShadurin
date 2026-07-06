import { error } from '@/server/http';

export const ADMIN_READ_API_DEFAULT_LIMIT = 50;
export const ADMIN_READ_API_MAX_LIMIT = 500;

export type ReadApiListParams = {
  limit: number;
  cursor: {
    id: string;
    createdAt: Date;
  } | null;
};

export type ReadApiListParamResult =
  | { params: ReadApiListParams; error: null }
  | { params: null; error: Response };

export type FieldSelectionResult<T extends string> =
  | { fields: T[]; error: null }
  | { fields: null; error: Response };

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parseBooleanQuery(value: string | null, defaultValue = false) {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function parseDateQuery(value: string | null, endOfDay = false): Date | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseReadApiListParams(searchParams: URLSearchParams): ReadApiListParamResult {
  const limit = parsePositiveInteger(searchParams.get('limit'), ADMIN_READ_API_DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1 || limit > ADMIN_READ_API_MAX_LIMIT) {
    return {
      params: null,
      error: error(
        'VALIDATION_ERROR',
        `limit must be an integer between 1 and ${ADMIN_READ_API_MAX_LIMIT}`,
        400,
      ),
    };
  }

  const rawCursor = searchParams.get('cursor')?.trim();
  if (!rawCursor) {
    return { params: { limit, cursor: null }, error: null };
  }

  const cursor = decodeReadApiCursor(rawCursor);
  if (!cursor) {
    return {
      params: null,
      error: error('VALIDATION_ERROR', 'Invalid cursor', 400),
    };
  }

  return { params: { limit, cursor }, error: null };
}

export function encodeReadApiCursor(row: { id: string; createdAt: Date | string }) {
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return Buffer.from(JSON.stringify({ id: row.id, createdAt }), 'utf8').toString('base64url');
}

export function decodeReadApiCursor(value: string): ReadApiListParams['cursor'] | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.id !== 'string' || !parsed.id.trim()) return null;
    if (typeof parsed.createdAt !== 'string' || !parsed.createdAt.trim()) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return {
      id: parsed.id,
      createdAt,
    };
  } catch {
    return null;
  }
}

export function cursorWhere(cursor: ReadApiListParams['cursor']) {
  if (!cursor) return null;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        AND: [
          { createdAt: cursor.createdAt },
          { id: { lt: cursor.id } },
        ],
      },
    ],
  };
}

export function andWhere(...parts: Array<Record<string, unknown> | null | undefined>) {
  const clean = parts.filter(Boolean) as Array<Record<string, unknown>>;
  if (clean.length === 0) return undefined;
  if (clean.length === 1) return clean[0];
  return { AND: clean };
}

export function resolveFieldSelection<T extends string>(
  searchParams: URLSearchParams,
  allowedFields: readonly T[],
  defaultFields: readonly T[],
): FieldSelectionResult<T> {
  const raw = searchParams.get('fields');
  if (!raw || !raw.trim()) {
    return { fields: Array.from(defaultFields), error: null };
  }

  const allowed = new Set(allowedFields);
  const fields = raw
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (fields.length === 0) {
    return {
      fields: null,
      error: error('VALIDATION_ERROR', 'fields must include at least one field name', 400),
    };
  }

  const uniqueFields = Array.from(new Set(fields)) as T[];
  const unknown = uniqueFields.filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    return {
      fields: null,
      error: error(
        'VALIDATION_ERROR',
        `Unknown or disallowed field(s): ${unknown.join(', ')}`,
        400,
        { allowedFields },
      ),
    };
  }

  return { fields: uniqueFields, error: null };
}

export function pickFields<T extends string>(
  fields: readonly T[],
  values: Record<T, unknown>,
): Partial<Record<T, unknown>> {
  const result: Partial<Record<T, unknown>> = {};
  for (const field of fields) {
    result[field] = values[field];
  }
  return result;
}

export function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function noStoreInit(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  headers.set('cache-control', 'no-store');
  return { ...init, headers };
}
