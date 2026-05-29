// LOG_FORMAT=json emite JSON estruturado (mesmo esquema de lib/log.ts)
// compatível com pipelines de log (Railway structured logs, Datadog, etc.).
// Padrão: texto legível para desenvolvimento local.
type LogLevel = 'info' | 'warn' | 'error' | 'success';
type LogData  = Record<string, unknown> | undefined;

const USE_JSON = process.env.LOG_FORMAT === 'json';
const ICONS: Record<LogLevel, string> = { info: '→', warn: '⚠', error: '✗', success: '✓' };

function emit(level: LogLevel, message: string, data?: LogData): void {
  if (USE_JSON) {
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    out(JSON.stringify({ level, msg: message, ts: new Date().toISOString(), ...data }));
    return;
  }
  const prefix    = ICONS[level];
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const dataStr   = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] ${prefix} ${message}${dataStr}`);
}

export const logger = {
  info:    (msg: string, data?: LogData) => emit('info',    msg, data),
  warn:    (msg: string, data?: LogData) => emit('warn',    msg, data),
  error:   (msg: string, data?: LogData) => emit('error',   msg, data),
  success: (msg: string, data?: LogData) => emit('success', msg, data),
};
