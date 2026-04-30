'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserAlert, DealsproProfile } from '@/lib/types';

const SIZE_OPTIONS = ['', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

interface Props {
  profile: DealsproProfile | null;
  alerts: UserAlert[];
  userId: string;
}

export function AlertsUI({ profile, alerts: initial, userId }: Props) {
  const [alerts, setAlerts]     = useState<UserAlert[]>(initial);
  const [keyword, setKeyword]   = useState('');
  const [size, setSize]         = useState('');
  const [error, setError]       = useState('');
  const [pending, startTrans]   = useTransition();

  const isPremium = profile?.plan === 'premium';
  const hasDiscord = !!profile?.discord_user_id;

  // Discord OAuth login
  const connectDiscord = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${location.origin}/alerts` },
    });
  };

  const addAlert = () => {
    if (!keyword.trim()) { setError('Digite uma palavra-chave.'); return; }
    setError('');
    startTrans(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('user_alerts')
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
      await supabase.from('user_alerts').update({ is_active: !current }).eq('id', id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a)),
      );
    });
  };

  const deleteAlert = (id: string) => {
    startTrans(async () => {
      const supabase = createClient();
      await supabase.from('user_alerts').delete().eq('id', id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    });
  };

  // ── Premium gate ──────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-6 text-center space-y-3">
        <p className="text-2xl">🔒</p>
        <p className="font-semibold text-white">Recurso Premium</p>
        <p className="text-sm text-neutral-400">
          Alertas personalizados estão disponíveis apenas para usuários premium.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Discord connection status */}
      <div className={`flex items-center justify-between rounded-xl border p-4 ${hasDiscord ? 'border-green-500/30 bg-green-500/5' : 'border-white/8 bg-[#141414]'}`}>
        <div>
          <p className="text-sm font-medium text-white">
            {hasDiscord ? `Discord conectado: ${profile.discord_username}` : 'Conectar Discord'}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {hasDiscord ? 'Você receberá DMs quando um alerta disparar.' : 'Necessário para receber notificações.'}
          </p>
        </div>
        {!hasDiscord && (
          <button
            onClick={connectDiscord}
            className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4] transition-colors"
          >
            Conectar
          </button>
        )}
      </div>

      {/* Add alert form */}
      <div className="rounded-xl border border-white/8 bg-[#141414] p-4 space-y-3">
        <p className="text-sm font-medium text-white">Novo alerta</p>
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAlert()}
            placeholder="Palavra-chave (ex: hoodie, backpack…)"
            className="flex-1 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-orange-500 transition-colors"
          />
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-neutral-300 outline-none focus:border-orange-500 transition-colors"
          >
            <option value="">Qualquer tam.</option>
            {SIZE_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={addAlert}
            disabled={pending}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            Adicionar
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum alerta cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${alert.is_active ? 'border-white/8 bg-[#141414]' : 'border-white/5 bg-[#0f0f0f] opacity-60'}`}
            >
              <div>
                <span className="text-sm font-medium text-neutral-200">{alert.keyword}</span>
                {alert.size && (
                  <span className="ml-2 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">
                    {alert.size}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAlert(alert.id, alert.is_active)}
                  disabled={pending}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  {alert.is_active ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => deleteAlert(alert.id)}
                  disabled={pending}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
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
