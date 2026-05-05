'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserAlert, DealsproProfile } from '@/lib/types';

const SIZE_OPTIONS = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44'];
const MAX_ALERTS = 10;

interface Props {
  profile: DealsproProfile | null;
  alerts: UserAlert[];
  userId: string;
}

export function AlertsUI({ profile, alerts: initial, userId }: Props) {
  const [alerts, setAlerts]   = useState<UserAlert[]>(initial);
  const [keyword, setKeyword] = useState('');
  const [size, setSize]       = useState('');
  const [error, setError]     = useState('');
  const [pending, startTrans] = useTransition();

  const isPremium  = profile?.plan === 'premium';
  const hasDiscord = !!profile?.discord_user_id;

  const connectDiscord = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/alerts`,
        scopes: 'identify email',
      },
    });
  };

  const addAlert = () => {
    if (!keyword.trim()) { setError('Digite uma palavra-chave.'); return; }
    if (alerts.length >= MAX_ALERTS) { setError(`Limite de ${MAX_ALERTS} alertas atingido.`); return; }
    setError('');
    startTrans(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('user_alerts_dealspro')
        .insert({ user_id: userId, keyword: keyword.trim(), size: size || null })
        .select()
        .single();
      if (err) { setError(err.message); return; }
      setAlerts((prev) => [data as UserAlert, ...prev]);
      setKeyword('');
      setSize('');
    });
  };

  const toggleAlert = (id: string, current: boolean) => {
    startTrans(async () => {
      const supabase = createClient();
      await supabase.from('user_alerts_dealspro').update({ is_active: !current }).eq('id', id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a)));
    });
  };

  const deleteAlert = (id: string) => {
    startTrans(async () => {
      const supabase = createClient();
      await supabase.from('user_alerts_dealspro').delete().eq('id', id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    });
  };

  // ── Premium gate ─────────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-2xl">
          🔒
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>Recurso Premium</p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Receba uma DM no Discord quando um produto com sua palavra-chave aparecer.
          </p>
        </div>
        <a
          href="/upgrade"
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          ⚡ Assinar Premium
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Discord connection */}
      <div
        className="flex items-center justify-between rounded-xl border p-4 gap-3"
        style={{
          background: hasDiscord ? 'rgba(34,197,94,0.05)' : 'var(--surface)',
          borderColor: hasDiscord ? 'rgba(34,197,94,0.3)' : 'var(--border)',
        }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {hasDiscord ? `Discord: ${profile.discord_username}` : 'Conectar Discord'}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
            {hasDiscord ? 'Você receberá DMs quando um alerta disparar.' : 'Necessário para receber notificações.'}
          </p>
        </div>
        {!hasDiscord && (
          <button
            onClick={connectDiscord}
            className="shrink-0 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4] transition-colors"
          >
            Conectar
          </button>
        )}
        {hasDiscord && (
          <span className="shrink-0 text-green-500 text-lg">✓</span>
        )}
      </div>

      {/* Add alert form */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Novo alerta</p>
          <span className="text-xs" style={{ color: 'var(--text-4)' }}>{alerts.length}/{MAX_ALERTS}</span>
        </div>
        {/* Stacked on mobile, row on sm+ */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAlert()}
            placeholder="Palavra-chave (ex: hoodie, backpack…)"
            className="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <div className="flex gap-2">
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="flex-1 sm:flex-none rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <option value="">Qualquer tam.</option>
              {SIZE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={addAlert}
              disabled={pending || alerts.length >= MAX_ALERTS}
              className="shrink-0 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="rounded-xl border py-10 text-center space-y-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-2xl">🔔</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Nenhum alerta ainda</p>
          <p className="text-xs" style={{ color: 'var(--text-4)' }}>Adicione uma palavra-chave acima para ser notificado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3 transition-all"
              style={{
                background: alert.is_active ? 'var(--surface)' : 'var(--bg)',
                borderColor: 'var(--border)',
                opacity: alert.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: alert.is_active ? 'var(--accent)' : 'var(--text-4)' }}
                />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{alert.keyword}</span>
                {alert.size && (
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {alert.size}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <button
                  onClick={() => toggleAlert(alert.id, alert.is_active)}
                  disabled={pending}
                  className="text-xs transition-colors disabled:opacity-50"
                  style={{ color: 'var(--text-3)' }}
                >
                  {alert.is_active ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => deleteAlert(alert.id)}
                  disabled={pending}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
