/**
 * Logger estruturado mínimo — uma linha JSON por log.
 *
 * O Vercel captura stdout/stderr automaticamente; emitir JSON permite filtrar
 * no painel (e em qualquer pipeline de logs futuro) por campo.
 *
 * Convenção:
 *   - `evt` é um identificador estável do evento (snake_case)
 *   - level via console method (info/warn/error)
 */
type Fields = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', evt: string, fields: Fields) {
  const payload = JSON.stringify({ level, evt, ts: new Date().toISOString(), ...fields });
  if      (level === 'error') console.error(payload);
  else if (level === 'warn')  console.warn(payload);
  else                        console.log(payload);
}

export const log = {
  info:  (evt: string, fields: Fields = {}) => emit('info',  evt, fields),
  warn:  (evt: string, fields: Fields = {}) => emit('warn',  evt, fields),
  error: (evt: string, fields: Fields = {}) => emit('error', evt, fields),
};
