'use client';

import { useState } from 'react';

interface Props {
  channel: 'discord' | 'telegram';
}

export function TestDmButton({ channel }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError]   = useState('');

  const color = channel === 'discord' ? '#5865F2' : '#229ED9';

  const test = async () => {
    setStatus('sending');
    setError('');
    try {
      const res  = await fetch(channel === 'discord' ? '/api/test-discord' : '/api/test-telegram', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatus('ok');
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
        setError(data.error ?? 'Erro');
        setTimeout(() => { setStatus('idle'); setError(''); }, 6000);
      }
    } catch {
      setStatus('error');
      setError('Falha de rede');
      setTimeout(() => { setStatus('idle'); setError(''); }, 6000);
    }
  };

  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${color}22` }}>
      <button
        onClick={test}
        disabled={status === 'sending'}
        className="w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50"
        style={{
          borderColor: status === 'ok'    ? 'rgba(34,197,94,0.4)'
                     : status === 'error' ? 'rgba(248,113,113,0.4)'
                     : `${color}55`,
          color:       status === 'ok'    ? '#22c55e'
                     : status === 'error' ? '#f87171'
                     : color,
          background:  status === 'ok'    ? 'rgba(34,197,94,0.06)'
                     : `${color}0d`,
        }}
      >
        {status === 'sending' ? 'Enviando…'
         : status === 'ok'    ? '✓ DM enviada!'
         : status === 'error' ? '✗ Falhou'
         : 'Testar DM'}
      </button>
      {status === 'error' && error && (
        <p className="mt-1 text-[10px] text-center text-red-400">{error}</p>
      )}
    </div>
  );
}
