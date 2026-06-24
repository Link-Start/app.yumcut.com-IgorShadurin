import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTimeAdmin } from '@/lib/date';
import type { ProjectErrorDetail, ProjectErrorLogFile } from '@/server/projects/errors';

type AdminProjectErrorDetailsProps = {
  occurredAt?: string | null;
  details?: ProjectErrorDetail[];
  logFile?: ProjectErrorLogFile | null;
  extra?: Record<string, unknown> | null;
};

const OMITTED_EXTRA_KEYS = new Set([
  'command',
  'sourceImages',
]);

function sanitizeExtraValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeExtraValue);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (OMITTED_EXTRA_KEYS.has(key)) continue;
      if (key === 'imagePrank' && entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const imagePrank = entry as Record<string, unknown>;
        const sourceImages = Array.isArray(imagePrank.sourceImages) ? imagePrank.sourceImages : [];
        sanitized[key] = {
          mode: imagePrank.mode,
          catalogItem: imagePrank.catalogItem,
          sourceImageCount: sourceImages.length,
        };
        continue;
      }
      sanitized[key] = sanitizeExtraValue(entry);
    }
    return sanitized;
  }

  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}…`;
  }

  return value;
}

export function AdminProjectErrorDetails({ occurredAt, details = [], logFile, extra }: AdminProjectErrorDetailsProps) {
  const sanitizedExtra = extra ? sanitizeExtraValue(extra) : null;
  if (details.length === 0 && !logFile && !sanitizedExtra && !occurredAt) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Admin error details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {occurredAt ? (
          <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div className="font-medium text-gray-500 dark:text-gray-400">Recorded</div>
            <div className="break-words text-gray-900 dark:text-gray-100">{formatDateTimeAdmin(occurredAt)}</div>
          </div>
        ) : null}

        {logFile ? (
          <div className="space-y-2">
            <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="font-medium text-gray-500 dark:text-gray-400">
                {logFile.source === 'template-launch' ? 'Template launch log' : 'Error log file'}
              </div>
              <div className="break-all font-mono text-xs leading-5 text-gray-900 dark:text-gray-100">
                {logFile.path}
              </div>
            </div>
            <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-md border bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {logFile.content}
            </pre>
            {logFile.truncated ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing a truncated log preview from {logFile.sizeBytes.toLocaleString()} bytes.
              </div>
            ) : null}
          </div>
        ) : null}

        {details.length > 0 ? (
          <div className="space-y-2">
            {details.map((detail) => (
              <div key={`${detail.label}:${detail.value}`} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]">
                <div className="font-medium text-gray-500 dark:text-gray-400">{detail.label}</div>
                <div className="break-words font-mono text-xs leading-5 text-gray-900 dark:text-gray-100">
                  {detail.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {sanitizedExtra ? (
          <div>
            <div className="mb-2 font-medium text-gray-500 dark:text-gray-400">Status extra preview</div>
            <pre className="max-h-80 overflow-auto rounded-md border bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {JSON.stringify(sanitizedExtra, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
