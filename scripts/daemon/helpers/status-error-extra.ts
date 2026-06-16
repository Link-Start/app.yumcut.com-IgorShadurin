export function buildStatusErrorExtra(
  phase: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const error = err instanceof Error
    ? err.message
    : typeof err === 'string'
      ? err
      : String(err);
  const errorName = err instanceof Error && err.name ? err.name : null;
  const errorRecord = err && typeof err === 'object' ? err as Record<string, unknown> : null;
  const command = typeof errorRecord?.command === 'string' && errorRecord.command.trim()
    ? errorRecord.command.trim()
    : null;
  const logPath = typeof errorRecord?.logPath === 'string' && errorRecord.logPath.trim()
    ? errorRecord.logPath.trim()
    : null;

  return {
    phase,
    ...extra,
    error,
    ...(errorName ? { errorName } : {}),
    ...(command && extra.command === undefined ? { command } : {}),
    ...(logPath && extra.logPath === undefined ? { logPath } : {}),
  };
}
