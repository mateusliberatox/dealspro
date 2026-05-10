'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserAlert, DealsproProfile } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const MAX_ALERTS = 10;

// Grupos de tamanho organizados por tipo
const SIZE_GROUPS = [
  {
    label: 'Roupa',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
  },
  {
    label: 'Calçado EU',
    sizes: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
  },
  {
    label: 'Calçado US',
    sizes: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12', '13'],
  },
];

interface Props {
  profile: DealsproProfile | null;
  alerts: UserAlert[];
  userId: string;
}

export function AlertsUI({ profile, alerts: initial, userId }: Props) {
  const [alerts, setAlerts]       = useState<UserAlert[]>(initial);
  const [keyword, setKeyword]     = useState('');
  const [size, setSize]           = useState('');
  const [categoria, setCategoria] = useState('');
  const [error, setError]         = useState('');
  const [pending, startTrans] = useTransition();

  // Estado do botão de teste de DM
  const [dmStatus, setDmStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [dmError, setDmError]   = useState('');

  const isPremium  = profile?.plan === 'premium';
  const hasDiscord = !!profile?.discord_user_id;

  const testDM = async () => {
    setDmStatus('sending');
    setDmError('');
    try {
      const res  = await fetch('/api/test-discord', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDmStatus('ok');
        setTimeout(() => setDmStatus('idle'), 5000);
      } else {
        setDmStatus('error');
        setDmError(data.error ?? 'Erro desconhecido');
        setTimeout(() => setDmStatus('idle'), 6000);
      }
    } catch {
      setDmStatus('error');
      setDmError('Falha de rede');
      setTimeout(() => setDmStatus('idle'), 6000);
    }
  };

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
    if (!keyword.trim() && !categoria) { setError('Informe ao menos uma palavra-chave ou categoria.'); return; }
    if (alerts.length >= MAX_ALERTS) { setError(`Limite de ${MAX_ALERTS} alertas atingido.`); return; }
    setError('');
    startTrans(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('user_alerts_dealspro')
        .insert({
          user_id:   userId,
          keyword:   keyword.trim() || '',
          size:      size || null,
          categoria: categoria || null,
        })
        .select()
        .single();
      if (err) { setError(err.message); return; }
      setAlerts((prev) => [data as UserAlert, ...prev]);
      setKeyword('');
      setSize('');
      setCategoria('');
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
      <div className="rounded-xl border py-12 text-center space-y-4" style={{ borderColor: 'var(--border-strong)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Recurso Premium</p>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Receba uma DM no Discord quando um produto com sua palavra-chave aparecer.
        </p>
        <a
          href="/upgrade"
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Assinar Premium
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Status do Discord */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: hasDiscord ? 'rgba(34,197,94,0.04)' : 'var(--surface)',
          borderColor: hasDiscord ? 'rgba(34,197,94,0.25)' : 'var(--border)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {hasDiscord ? `Discord: ${profile.discord_username}` : 'Conectar Discord'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {hasDiscord
                ? 'Você receberá DMs quando um alerta disparar.'
                : 'Necessário para receber notificações por DM.'}
            </p>
          </div>
          {hasDiscord ? (
            <span className="shrink-0 text-sm font-medium text-green-500">✓ Conectado</span>
          ) : (
            <button
              onClick={connectDiscord}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#5865F2' }}
            >
              Conectar
            </button>
          )}
        </div>

        {/* Testar DM — linha separada para não comprimir o botão Conectar */}
        {hasDiscord && (
          <div className="mt-3 flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(34,197,94,0.15)' }}>
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
            {dmStatus === 'error' && dmError && (
              <p className="text-[10px] text-red-400">{dmError}</p>
            )}
          </div>
        )}
      </div>

      {/* Form de novo alerta */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Novo alerta</p>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>{alerts.length}/{MAX_ALERTS}</span>
        </div>

        {/* Linha 1: palavra-chave */}
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAlert()}
          placeholder="Palavra-chave (ex: hoodie, backpack…)"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        {/* Linha 2: categoria + tamanho + botão */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: categoria ? 'var(--text)' : 'var(--text-3)' }}
          >
            <option value="">Qualquer categoria</option>
            {CATEGORIES.filter((c) => c !== 'Todos').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="flex-1 sm:flex-none rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <option value="">Qualquer tam.</option>
            {SIZE_GROUPS.map(({ label, sizes }) => (
              <optgroup key={label} label={label}>
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            onClick={addAlert}
            disabled={pending || alerts.length >= MAX_ALERTS}
            className="shrink-0 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            Adicionar
          </button>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Preencha palavra-chave e/ou categoria. Se ambos, o produto deve satisfazer os dois filtros.
        </p>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Lista de alertas */}
      {alerts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Nenhum alerta. Adicione uma palavra-chave acima.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3 transition-all"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                opacity: alert.is_active ? 1 : 0.45,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: alert.is_active ? 'var(--accent)' : 'var(--text-3)' }}
                />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {alert.keyword || <em style={{ color: 'var(--text-3)', fontStyle: 'normal' }}>Qualquer produto</em>}
                </span>
                {alert.categoria && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(251,146,60,0.12)', color: 'var(--accent)' }}
                  >
                    {alert.categoria}
                  </span>
                )}
                {alert.size && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
                  >
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
                  className="text-xs transition-colors disabled:opacity-50 hover:text-red-300"
                  style={{ color: '#f87171' }}
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
