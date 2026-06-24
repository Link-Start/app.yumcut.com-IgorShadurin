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

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getImagePrankSourceImages(extra: Record<string, unknown> | null | undefined): unknown[] {
  const imagePrank = extra?.imagePrank;
  if (!imagePrank || typeof imagePrank !== 'object' || Array.isArray(imagePrank)) return [];
  const sourceImages = (imagePrank as Record<string, unknown>).sourceImages;
  return Array.isArray(sourceImages) ? sourceImages : [];
}

function extractCommandFromLog(content: string | null | undefined): string | null {
  const text = normalizeString(content);
  if (!text) return null;
  const match = text.match(/^Command:\s*([\s\S]*?)(?:\nCWD:|\nProject:|\nStarted:|\n--- STREAM BEGIN ---|$)/u);
  return normalizeString(match?.[1]);
}

function removeCommandFromLog(content: string): string {
  return content.replace(/^Command:\s*[\s\S]*?(?=\n(?:CWD:|Project:|Started:|--- STREAM BEGIN ---|$))/u, 'Command: [collapsed]');
}

function getCommand(extra: Record<string, unknown> | null | undefined, logFile: ProjectErrorLogFile | null | undefined): string | null {
  return normalizeString(extra?.command) ?? extractCommandFromLog(logFile?.content);
}

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
  const command = getCommand(extra, logFile);
  const sourceImages = getImagePrankSourceImages(extra);
  const sanitizedExtra = extra ? sanitizeExtraValue(extra) : null;
  const fullExtra = extra ? JSON.stringify(extra, null, 2) : null;
  const logContent = logFile?.content ? (command ? removeCommandFromLog(logFile.content) : logFile.content) : null;
  if (details.length === 0 && !logFile && !sanitizedExtra && !occurredAt && !command && !fullExtra) return null;

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
            {logContent ? (
              <details open className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  Log output
                </summary>
                <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap border-t bg-gray-950 p-3 text-xs leading-5 text-gray-100">
                  {logContent}
                </pre>
              </details>
            ) : null}
            {logFile.truncated ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing a truncated log preview from {logFile.sizeBytes.toLocaleString()} bytes.
              </div>
            ) : null}
          </div>
        ) : null}

        {command ? (
          <details className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Command
            </summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {command}
            </pre>
          </details>
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

        {sourceImages.length > 0 ? (
          <details className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Source images
            </summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {JSON.stringify(sourceImages, null, 2)}
            </pre>
          </details>
        ) : null}

        {sanitizedExtra ? (
          <div>
            <div className="mb-2 font-medium text-gray-500 dark:text-gray-400">Status extra preview</div>
            <pre className="max-h-80 overflow-auto rounded-md border bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {JSON.stringify(sanitizedExtra, null, 2)}
            </pre>
          </div>
        ) : null}

        {fullExtra ? (
          <details className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Full status extra
            </summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t bg-gray-950 p-3 text-xs leading-5 text-gray-100">
              {fullExtra}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
