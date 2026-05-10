'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type Mode = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode]         = useState<Mode>('login');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const router = useRouter();

  // Lê erros passados via query param pelo callback OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('error');
    if (e === 'auth_failed') {
      setError('Autenticação com Discord falhou. Verifique se sua conta Discord tem e-mail verificado e tente novamente.');
    } else if (e === 'missing_code') {
      setError('Código de autenticação ausente. Tente novamente.');
    } else if (e) {
      setError(`Erro de autenticação: ${e}`);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else router.push('/');
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/`,
      });
      if (error) setError(error.message);
      else setSuccess('Link de recuperação enviado. Verifique seu e-mail.');
    }
    setLoading(false);
  }, [email, password, mode, router]);

  const loginWithDiscord = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${location.origin}/auth/callback`, scopes: 'identify email' },
    });
  };

  const switchMode = (next: Mode) => { setMode(next); setError(''); setSuccess(''); };

  const titles: Record<Mode, string> = {
    login:  'Entre na sua conta',
    signup: 'Crie sua conta grátis',
    forgot: 'Recuperar senha',
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg)' }}
    >
      {/* Radial glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center" aria-hidden>
        <div
          className="h-[500px] w-[700px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in-up">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" aria-hidden className="h-10 w-10 rounded-full" />
            <span className="text-xl font-black uppercase tracking-[0.03em]">
              <span style={{ color: 'var(--text)' }}>DEALS</span>
              <span className="gradient-blue-text">PRO</span>
            </span>
          </Link>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{titles[mode]}</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 space-y-5">

          {/* Discord OAuth */}
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={loginWithDiscord}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#5865F2' }}
            >
              <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="white">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Continuar com Discord
            </button>
          )}

          {mode !== 'forgot' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t" style={{ borderColor: 'rgba(59,130,246,0.15)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>ou</span>
              <div className="flex-1 border-t" style={{ borderColor: 'rgba(59,130,246,0.15)' }} />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="E-mail"
              className="w-full cursor-text rounded-xl border px-4 py-3 text-sm outline-none transition-all"
              style={{ background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(59,130,246,0.2)', color: 'var(--text)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)')}
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Senha"
                className="w-full cursor-text rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                style={{ background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(59,130,246,0.2)', color: 'var(--text)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)')}
              />
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="cursor-pointer text-xs transition-colors hover:underline"
                  style={{ color: 'var(--text-3)' }}
                >
                  Esqueci a senha
                </button>
              </div>
            )}

            {error && (
              <p className="rounded-xl px-4 py-2.5 text-sm text-red-400"
                 style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-xl px-4 py-2.5 text-sm text-green-400"
                 style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="gradient-blue-bright ripple shine-effect w-full cursor-pointer rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Aguarde…'
                : mode === 'login'  ? 'Entrar'
                : mode === 'signup' ? 'Criar conta'
                : 'Enviar link de recuperação'}
            </button>
          </form>

          {/* Mode switcher */}
          <div className="flex items-center justify-center gap-1.5 text-sm">
            {mode === 'forgot' ? (
              <button
                onClick={() => switchMode('login')}
                className="cursor-pointer font-medium transition-colors hover:underline"
                style={{ color: 'var(--accent-text)' }}
              >
                ← Voltar ao login
              </button>
            ) : (
              <>
                <span style={{ color: 'var(--text-3)' }}>
                  {mode === 'login' ? 'Sem conta?' : 'Já tem conta?'}
                </span>
                <button
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="cursor-pointer font-medium transition-colors hover:underline"
                  style={{ color: 'var(--accent-text)' }}
                >
                  {mode === 'login' ? 'Criar grátis' : 'Entrar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
