import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTimeAdmin } from '@/lib/date';
import type { ProjectErrorDetail, ProjectErrorLogFile } from '@/server/projects/errors';

type AdminProjectErrorDetailsProps = {
  occurredAt?: string | null;
  details?: ProjectErrorDetail[];
  logFile?: ProjectErrorLogFile | null;
  extra?: Record<string, unknown> | null;
};

export function AdminProjectErrorDetails({ occurredAt, details = [], logFile, extra }: AdminProjectErrorDetailsProps) {
  if (details.length === 0 && !logFile && !extra && !occurredAt) return null;

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

        {extra ? (
          <div>
            <div className="mb-2 font-medium text-gray-500 dark:text-gray-400">Raw status extra</div>
            <pre className="max-h-80 overflow-auto rounded-md border bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {JSON.stringify(extra, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
