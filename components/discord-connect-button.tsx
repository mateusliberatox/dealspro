'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  connected:  boolean;
  username?:  string | null;
  avatar?:    string | null;
  testOnly?:  boolean; // só mostra o botão de testar DM, sem info de identidade
}

export function DiscordConnectButton({ connected, username, avatar, testOnly = false }: Props) {
  const [error, setError]       = useState('');
  const [dmStatus, setDmStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const connect = async () => {
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/minha-conta`,
        scopes: 'identify email',
      },
    });
    if (error) setError(error.message);
  };

  const testDM = async () => {
    setDmStatus('sending');
    try {
      const res  = await fetch('/api/test-discord', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDmStatus('ok');
        setTimeout(() => setDmStatus('idle'), 5000);
      } else {
        setDmStatus('error');
        setError(data.error ?? 'Erro desconhecido');
        setTimeout(() => { setDmStatus('idle'); setError(''); }, 6000);
      }
    } catch {
      setDmStatus('error');
      setError('Falha de rede');
      setTimeout(() => { setDmStatus('idle'); setError(''); }, 6000);
    }
  };

  if (connected) {
    const testBtn = (
      <div className="flex items-center gap-3">
        <button
          onClick={testDM}
          disabled={dmStatus === 'sending'}
          className="text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            color: dmStatus === 'ok'    ? '#22c55e'
                 : dmStatus === 'error' ? '#f87171'
                 : 'var(--text-3)',
          }}
        >
          {dmStatus === 'sending' ? 'Enviando…'
           : dmStatus === 'ok'    ? '✓ DM enviada!'
           : dmStatus === 'error' ? '✗ Falhou'
           : 'Testar DM'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );

    if (testOnly) return testBtn;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {avatar && (
            <img src={avatar} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div>
            <p className="text-sm font-medium text-green-500">✓ Vinculado</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{username}</p>
          </div>
        </div>
        {testBtn}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--discord-color)' }}
      >
        <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="white" aria-hidden>
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        Vincular Discord
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-right">{error}</p>}
    </div>
  );
}
