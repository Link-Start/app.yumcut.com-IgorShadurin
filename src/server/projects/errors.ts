import type { Prisma } from '@prisma/client';
import { ProjectStatus } from '@/shared/constants/status';

type ProjectErrorLogEntry = {
  message?: string | null;
  extra?: unknown;
  createdAt?: Date | string | null;
};

export type ProjectErrorDetail = {
  label: string;
  value: string;
};

export type ProjectErrorStatusInfo = {
  message: string;
  occurredAt?: string | null;
  errorDetails?: ProjectErrorDetail[];
  errorExtra?: Record<string, unknown>;
};

export async function getLatestErrorLog(tx: Prisma.TransactionClient | typeof import('@/server/db').prisma, projectId: string) {
  // Fetch most recent error-specific log to avoid mixing with non-error updates.
  const errorLog = await (tx as any).projectStatusHistory.findFirst({
    where: { projectId, status: ProjectStatus.Error },
    orderBy: { createdAt: 'desc' },
    select: { message: true, extra: true, createdAt: true },
  });
  return errorLog || null;
}

export function buildProjectErrorStatusInfo(
  errorLog: ProjectErrorLogEntry | null | undefined,
  fallbackLog?: ProjectErrorLogEntry | null,
  options: { includeDetails?: boolean; includeExtra?: boolean; includeOccurredAt?: boolean } = {},
): ProjectErrorStatusInfo {
  const selectedLog = errorLog ?? fallbackLog ?? null;
  const extra = toPlainRecord(selectedLog?.extra);
  const nestedMeta = toPlainRecord(extra?.meta);
  const message =
    normalizeString(selectedLog?.message)
    ?? normalizeString(extra?.message)
    ?? normalizeString(nestedMeta?.message)
    ?? 'Unknown error';

  const includeDetails = options.includeDetails || options.includeExtra;
  const includeOccurredAt = options.includeOccurredAt || options.includeExtra;
  const details = includeDetails ? collectErrorDetails(extra, nestedMeta) : [];
  return {
    message,
    ...(includeOccurredAt ? { occurredAt: normalizeDate(selectedLog?.createdAt) } : {}),
    ...(details.length > 0 ? { errorDetails: details } : {}),
    ...(options.includeExtra && extra ? { errorExtra: extra } : {}),
  };
}

function collectErrorDetails(extra: Record<string, unknown> | null, nestedMeta: Record<string, unknown> | null): ProjectErrorDetail[] {
  if (!extra && !nestedMeta) return [];
  const details: ProjectErrorDetail[] = [];
  const add = (label: string, value: unknown) => {
    const normalized = normalizeString(value);
    if (!normalized) return;
    if (details.some((detail) => detail.label === label && detail.value === normalized)) return;
    details.push({ label, value: normalized });
  };

  add('Phase', extra?.phase);
  add('Step', extra?.failedStep ?? extra?.step);
  add('Language', extra?.failedLanguage ?? extra?.languageCode);
  add('Reason', extra?.reason ?? nestedMeta?.reason);
  add('Error', extra?.error ?? nestedMeta?.error);
  add('Command', extra?.command);
  add('Log path', extra?.logPath);
  add('Log directory', extra?.logDir);
  add('Workspace', extra?.workspace ?? extra?.workspaceRoot);
  add('Metadata JSON', extra?.metadataJsonPath);
  return details;
}

function toPlainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return normalizeString(value);
}
