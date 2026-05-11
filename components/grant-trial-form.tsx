'use client';

import { useState } from 'react';

export function GrantTrialForm() {
  const [email, setEmail]   = useState('');
  const [hours, setHours]   = useState(24);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg]       = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMsg('');
    const res  = await fetch('/api/admin/grant-trial', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, hours }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus('ok');
      setMsg(`✓ Trial de ${hours}h concedido para ${email}. Expira em ${new Date(data.trial_ends_at).toLocaleString('pt-BR')}`);
      setEmail('');
    } else {
      setStatus('error');
      setMsg(`✗ ${data.error}`);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email do usuário"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            required
            min={1}
            max={720}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-20 rounded-lg border px-3 py-2 text-sm outline-none text-center"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <span className="text-sm shrink-0" style={{ color: 'var(--text-3)' }}>horas</span>
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          {status === 'loading' ? 'Aguarde…' : 'Conceder trial'}
        </button>
      </div>
      {msg && (
        <p className="text-xs" style={{ color: status === 'ok' ? '#22c55e' : '#f87171' }}>
          {msg}
        </p>
      )}
    </form>
  );
}
