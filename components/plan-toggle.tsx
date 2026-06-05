'use client';

import { useState } from 'react';
import { UpgradeButton } from './upgrade-button';

export function PlanToggle() {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div
        className="inline-flex items-center rounded-xl p-1 text-sm font-semibold"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setPlan('monthly')}
          className="rounded-lg px-4 py-1.5 transition-all text-xs"
          style={{
            background: plan === 'monthly' ? 'var(--surface)' : 'transparent',
            color:      plan === 'monthly' ? 'var(--text)' : 'var(--text-3)',
            boxShadow:  plan === 'monthly' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Mensal
        </button>
        <button
          onClick={() => setPlan('annual')}
          className="rounded-lg px-4 py-1.5 transition-all text-xs flex items-center gap-1.5"
          style={{
            background: plan === 'annual' ? 'var(--surface)' : 'transparent',
            color:      plan === 'annual' ? 'var(--text)' : 'var(--text-3)',
            boxShadow:  plan === 'annual' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Anual
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
          >
            -2 meses
          </span>
        </button>
      </div>

      {/* Preço */}
      {plan === 'monthly' ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            Assinatura mensal
          </p>
          <div className="flex items-end justify-center gap-2">
            <p className="text-4xl font-extrabold tracking-tight gradient-blue-text">R$ 7,99</p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-3)' }}>no 1º mês</p>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>depois R$ 9,99/mês · cancele quando quiser</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            Assinatura anual
          </p>
          <div className="flex items-end justify-center gap-2">
            <p className="text-4xl font-extrabold tracking-tight gradient-blue-text">R$ 79,90</p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-3)' }}>/ano</p>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            equivale a <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>R$ 6,66/mês</span>
            {' '}· <span style={{ color: '#22c55e' }}>você economiza R$ 39,98</span>
          </p>
        </div>
      )}

      <UpgradeButton className="w-full py-4 text-base" variant="card" plan={plan} />
    </div>
  );
}
