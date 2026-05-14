function stamp() {
  return new Date().toISOString();
}

const SILENT = process.env.PUBLISH_DAEMON_SILENT === '1';
const DEBUG = process.env.PUBLISH_DAEMON_DEBUG === '1';

function format(meta?: Record<string, unknown>) {
  if (!meta || Object.keys(meta).length === 0) return '';
  return ` ${JSON.stringify(meta, null, 2)}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (SILENT) return;
     
    console.log(`[${stamp()}] INFO  ${message}${format(meta)}`);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (SILENT) return;
     
    console.warn(`[${stamp()}] WARN  ${message}${format(meta)}`);
  },
  error(message: string, meta?: Record<string, unknown>) {
     
    console.error(`[${stamp()}] ERROR ${message}${format(meta)}`);
  },
  debug(message: string, meta?: Record<string, unknown>) {
    if (!DEBUG || SILENT) return;
     
    console.debug(`[${stamp()}] DEBUG ${message}${format(meta)}`);
  },
};
