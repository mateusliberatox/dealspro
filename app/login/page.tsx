'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode]       = useState<'login' | 'signup'>('login');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar.');
    }

    setLoading(false);
  }, [email, password, mode, router]);

  const inputClass = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Brand + tagline */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-orange-500">DealsPro</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Deals do CSSDeals em tempo real
          </p>
          <p className="text-xs" style={{ color: 'var(--text-4)' }}>
            {mode === 'login' ? 'Entre na sua conta para acessar o feed' : 'Crie sua conta gratuitamente'}
          </p>
        </div>

        {/* Discord — destaque acima do form */}
        <button
          type="button"
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            await supabase.auth.signInWithOAuth({
              provider: 'discord',
              options: {
                redirectTo: `${location.origin}/auth/callback`,
                scopes: 'identify email',
              },
            });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: '#5865F2' }}
        >
          <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          Entrar com Discord
        </button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-4)' }}>ou com e-mail</span>
          <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-3)' }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-3)' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg px-3 py-2 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg px-3 py-2 text-sm text-green-400" style={{ background: 'rgba(34,197,94,0.1)' }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: 'var(--text-4)' }}>
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="font-medium text-orange-400 hover:text-orange-300 transition-colors"
          >
            {mode === 'login' ? 'Criar conta grátis' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  );
}
