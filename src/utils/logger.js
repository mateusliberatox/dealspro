const levels = { info: '→', warn: '⚠', error: '✗', success: '✓' };

function log(level, message, data) {
  const prefix = levels[level] ?? '·';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] ${prefix} ${message}${dataStr}`);
}

export const logger = {
  info: (msg, data) => log('info', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  error: (msg, data) => log('error', msg, data),
  success: (msg, data) => log('success', msg, data),
};
