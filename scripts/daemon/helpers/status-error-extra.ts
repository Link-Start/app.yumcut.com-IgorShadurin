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

  return {
    phase,
    ...extra,
    error,
    ...(errorName ? { errorName } : {}),
  };
}
