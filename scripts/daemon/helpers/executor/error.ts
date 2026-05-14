const HANDLED_ERROR = Symbol('daemonHandledError');

export type HandledJobResult = 'success' | 'failed';

type HandledErrorOptions = {
  jobResult?: HandledJobResult;
};

export function createHandledError(message: string, cause?: unknown, options: HandledErrorOptions = {}): Error {
  const error = cause instanceof Error ? new Error(message, { cause }) : new Error(message);
  (error as any)[HANDLED_ERROR] = true;
  (error as any).jobResult = options.jobResult ?? 'failed';
  return error;
}

export function isHandledError(error: unknown): boolean {
  return !!(error && typeof error === 'object' && (error as any)[HANDLED_ERROR]);
}

export function getHandledJobResult(error: unknown): HandledJobResult {
  if (!isHandledError(error)) return 'failed';
  return (error as any).jobResult === 'success' ? 'success' : 'failed';
}
