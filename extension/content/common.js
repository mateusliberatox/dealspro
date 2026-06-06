// ── Utilitários compartilhados ───────────────────────────────────────────────
// Injetado em todos os sites antes dos scripts específicos.

window.__dp = window.__dp || {};

// ── Cotação CNY→BRL ──────────────────────────────────────────────────────────

window.__dp.rate       = 0.82; // fallback enquanto carrega
window.__dp.freightBrl = 80;   // fallback de frete (R$)

chrome.runtime.sendMessage({ type: 'GET_RATE' }, (res) => {
  if (res?.rate) window.__dp.rate = res.rate;
});

// Carrega configuração de frete salva pelo usuário
chrome.storage.local.get('dpShipping', ({ dpShipping }) => {
  if (!dpShipping) return;
  // Se agente personalizado, usa valor direto
  if (dpShipping.agent === 'custom' && dpShipping.customBrl) {
    window.__dp.freightBrl = dpShipping.customBrl;
    return;
  }
  // Senão, recalcula com base na tabela (simplificado: guarda o brl calculado no popup)
  // O popup salva o valor calculado como dpShippingBrl para uso aqui
  chrome.storage.local.get('dpShippingBrl', ({ dpShippingBrl }) => {
    if (dpShippingBrl) window.__dp.freightBrl = dpShippingBrl;
  });
});

window.__dp.cnyToBrl = (cny) => {
  const num = parseFloat(String(cny).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return null;
  return (num * window.__dp.rate).toFixed(2);
};

window.__dp.formatBrl = (value) =>
  `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Toast ─────────────────────────────────────────────────────────────────────

window.__dp.toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = `dp-toast dp-toast--${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
};

// ── Injetar badge de preço em BRL ao lado de um preço CNY ─────────────────────

window.__dp.injectBrlBadge = (el, cnyValue) => {
  if (el.dataset.dpDone) return;
  el.dataset.dpDone = '1';
  const brl = window.__dp.cnyToBrl(cnyValue);
  if (!brl) return;
  const badge = document.createElement('span');
  badge.className = 'dp-brl-badge';
  badge.textContent = window.__dp.formatBrl(brl);
  el.insertAdjacentElement('afterend', badge);
};

// ── Módulos habilitados ───────────────────────────────────────────────────────

window.__dp.modulesEnabled = { converter: true, sizes: true, alerts: true };

chrome.storage.local.get('dpModules', ({ dpModules }) => {
  if (dpModules) window.__dp.modulesEnabled = { ...window.__dp.modulesEnabled, ...dpModules };
});

// ── MutationObserver helper ───────────────────────────────────────────────────

window.__dp.observe = (selector, callback, root = document.body) => {
  const run = () => document.querySelectorAll(selector).forEach(callback);
  run();
  new MutationObserver(run).observe(root, { childList: true, subtree: true });
};
