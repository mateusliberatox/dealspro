'use client';

import { useState } from 'react';

type Mode = 'alerts_only' | 'all_deals' | 'both';

const OPTIONS: { value: Mode; label: string; desc: string }[] = [
  { value: 'alerts_only', label: 'Só alertas',    desc: 'Apenas keywords e categorias configuradas' },
  { value: 'all_deals',   label: 'Todos os deals', desc: 'Todos os novos produtos detectados' },
  { value: 'both',        label: 'Alertas + todos', desc: 'Alertas configurados e feed completo' },
];

interface Props {
  current: Mode | null;
  isPremium: boolean;
}

export function TelegramModeSelector({ current, isPremium }: Props) {
  const [mode, setMode] = useState<Mode>(current ?? 'alerts_only');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next: Mode) {
    setMode(next);
    setSaving(true);
    setSaved(false);
    await fetch('/api/telegram/notify-mode', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: next }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const options = isPremium ? OPTIONS : OPTIONS.filter((o) => o.value !== 'both');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          Modo de notificação
        </p>
        {saving && <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>Salvando…</span>}
        {saved  && <span className="text-[11px] text-green-500">Salvo ✓</span>}
      </div>
      <div className="grid gap-2">
        {options.map((opt) => {
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => save(opt.value)}
              disabled={saving}
              className="flex items-start gap-3 rounded-xl border p-3 text-left transition-all"
              style={{
                background:  active ? 'rgba(34,158,217,0.08)' : 'var(--surface-2)',
                borderColor: active ? 'rgba(34,158,217,0.35)' : 'var(--border)',
                cursor:       saving ? 'wait' : 'pointer',
              }}
            >
              <span
                className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor:     active ? 'var(--telegram-color)' : 'var(--border)',
                  backgroundColor: active ? 'var(--telegram-color)' : 'transparent',
                }}
              >
                {active && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-xs font-semibold" style={{ color: active ? 'var(--telegram-color)' : 'var(--text)' }}>
                  {opt.label}
                </p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {!isPremium && (
        <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
          A opção "Alertas + todos" requer Premium.
        </p>
      )}
    </div>
  );
}
