'use client';

import { useEffect, useMemo, useState } from 'react';
import { FREIGHT_AGENTS, calcFreight } from '@/lib/freight';

const WEIGHT_PRESETS = [200, 500, 1000, 2000, 3000];

const AGENT_KEYS = Object.keys(FREIGHT_AGENTS);
const TAX_THRESHOLD_USD = 50;
// Aproximação fixa USD→BRL só para estimar se o produto-exemplo passaria do
// limiar de imposto — mesmo valor usado em extension/popup/popup.js.
const USD_BRL_APPROX = 5.8;

function formatBrl(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block',
};

interface FreightCalculatorProps {
  rate: number;
}

export function FreightCalculator({ rate }: FreightCalculatorProps) {
  const [agentKey, setAgentKey]   = useState(AGENT_KEYS[0]);
  const [method, setMethod]       = useState(Object.keys(FREIGHT_AGENTS[AGENT_KEYS[0]].methods)[0]);
  const [weightG, setWeightG]     = useState(500);
  const [customBrl, setCustomBrl] = useState(80);
  const [customPer100g, setCustomPer100g] = useState<number | ''>('');
  const [productBrl, setProductBrl] = useState(150);

  const isCustom = agentKey === 'custom';
  const agent    = FREIGHT_AGENTS[agentKey];

  // Ao trocar de agente, seleciona o primeiro método disponível
  useEffect(() => {
    if (!agent) return;
    const methods = Object.keys(agent.methods);
    if (!methods.includes(method)) setMethod(methods[0]);
  }, [agentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const freight = useMemo(
    () => calcFreight(agentKey, method, weightG, rate, {
      customBrl,
      customPer100g: typeof customPer100g === 'number' ? customPer100g : 0,
    }),
    [agentKey, method, weightG, rate, customBrl, customPer100g],
  );

  const productUsd = productBrl / USD_BRL_APPROX;
  const hasTax     = productUsd > TAX_THRESHOLD_USD;
  const taxBrl     = hasTax ? productBrl * 0.6 : 0;
  const totalBrl   = productBrl + freight.brl + taxBrl;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* ── Coluna de inputs ── */}
      <div
        className="space-y-4 rounded-xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <label style={labelStyle}>Agente de compras</label>
          <select
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value)}
            style={inputStyle}
          >
            {AGENT_KEYS.map((key) => (
              <option key={key} value={key}>{FREIGHT_AGENTS[key].name}</option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {!isCustom && (
          <div>
            <label style={labelStyle}>Método de envio</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              {Object.keys(agent.methods).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>Peso do pacote</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={10} max={50000} step={10}
              value={weightG}
              onChange={(e) => setWeightG(Math.max(10, parseInt(e.target.value) || 0))}
              style={inputStyle}
            />
            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-3)' }}>gramas</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEIGHT_PRESETS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setWeightG(g)}
                className="flex-1 rounded-md border px-1 py-1 text-[11px] font-semibold transition-colors"
                style={
                  weightG === g
                    ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent-text)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-2)' }
                }
              >
                {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
            O valor por kg é recalculado automaticamente conforme a tarifa do agente/método escolhido.
          </p>
        </div>

        {isCustom && (
          <>
            <div>
              <label style={labelStyle}>Custo de frete fixo (R$)</label>
              <input
                type="number" min={0} max={2000}
                value={customBrl}
                onChange={(e) => setCustomBrl(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Valor por 100g (R$) — opcional</label>
              <input
                type="number" min={0} max={500} step={0.5}
                placeholder="Ex: 8"
                value={customPer100g}
                onChange={(e) => setCustomPer100g(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
                Se preenchido, o frete é calculado proporcionalmente ao peso (R$ por 100g × peso),
                em vez do valor fixo acima — útil quando os valores do agente demoram para atualizar.
              </p>
            </div>
          </>
        )}

        <div>
          <label style={labelStyle}>Valor do produto (R$)</label>
          <input
            type="number" min={0}
            value={productBrl}
            onChange={(e) => setProductBrl(parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Coluna de resultado ── */}
      <div
        className="space-y-3 rounded-xl border p-5"
        style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-strong)' }}
      >
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--accent-text)' }}>
          📦 Estimativa para o Brasil
        </div>

        <Row label="Produto" value={formatBrl(productBrl)} />
        <Row
          label={`Frete${freight.cny ? ` (¥${freight.cny} × câmbio)` : isCustom && customPer100g ? ' (R$/100g × peso)' : ' (personalizado)'}`}
          value={formatBrl(freight.brl)}
        />
        {hasTax && (
          <Row label="Imposto (60%, produto > US$50)" value={formatBrl(taxBrl)} highlight="#f87171" />
        )}
        <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
        <Row label="Total estimado" value={formatBrl(totalBrl)} bold />

        {!isCustom && agent?.url && (
          <a
            href={agent.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-right text-xs font-medium hover:underline"
            style={{ color: 'var(--accent-text)' }}
          >
            Verificar no calculador do {agent.name} →
          </a>
        )}

        <p className="pt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          Câmbio atual: 1 ¥ ≈ {formatBrl(rate)}. Valores estimados — frete e imposto reais podem variar
          conforme o agente, a transportadora e a fiscalização aduaneira.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span
        style={{ color: highlight ?? 'var(--text)', fontWeight: bold ? 800 : 700 }}
        className={bold ? 'text-base' : undefined}
      >
        {value}
      </span>
    </div>
  );
}
