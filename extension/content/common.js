// ── Utilitários compartilhados ───────────────────────────────────────────────
// Injetado em todos os sites antes dos scripts específicos.

window.__dp = window.__dp || {};

// ── Cotação CNY→BRL ──────────────────────────────────────────────────────────

// NOTA: 0.82 é o câmbio de fallback CNY→BRL usado em 3 lugares (este arquivo,
// background.js e popup/popup.js) porque content scripts/service worker/popup
// rodam em contextos isolados e não compartilham módulos. Se o câmbio
// "fallback" mudar, atualize os 3 — todos têm este mesmo comentário.
window.__dp.rate = 0.82; // fallback enquanto carrega o câmbio real (GET_RATE)

// Fallback de frete (R$) até o usuário configurar/abrir "Config": equivalente
// ao agente padrão (CSBuy, E-Packet BR, ~500g) calculado em popup.js
// → AGENTS.cssbuy: 28 + 22*(0.5-0.1) = 36.8 CNY × 0.82 ≈ R$ 30.
window.__dp.freightBrl = 30;

chrome.runtime.sendMessage({ type: 'GET_RATE' }, (res) => {
  if (res?.rate) {
    window.__dp.rate = res.rate;
    // Recalcula o fallback de frete com o câmbio real, caso o usuário ainda
    // não tenha configurado/aberto "Config" (dpShippingBrl não definido).
    chrome.storage.local.get(['dpShipping', 'dpShippingBrl'], ({ dpShipping, dpShippingBrl }) => {
      if (dpShipping || dpShippingBrl) return;
      window.__dp.freightBrl = parseFloat((36.8 * window.__dp.rate).toFixed(2));
    });
    // GET_RATE é assíncrono — alguns badges já podem ter sido injetados com
    // o câmbio de fallback (0.82) antes da cotação real chegar. Atualiza o
    // texto deles para refletir o câmbio correto.
    window.__dp.refreshBadges();
  }
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
  el.dataset.dpCny = String(cnyValue); // usado por refreshBadges() ao atualizar o câmbio
  const brl = window.__dp.cnyToBrl(cnyValue);
  if (!brl) return;
  const badge = document.createElement('span');
  badge.className = 'dp-brl-badge';
  badge.textContent = window.__dp.formatBrl(brl);
  el.insertAdjacentElement('afterend', badge);
};

// Recalcula o texto de todos os badges BRL já injetados usando o câmbio
// atual (window.__dp.rate). Chamado quando a cotação real chega depois de
// badges já terem sido criados com o câmbio de fallback.
window.__dp.refreshBadges = () => {
  document.querySelectorAll('[data-dp-cny]').forEach((el) => {
    const badge = el.nextElementSibling;
    if (!badge?.classList.contains('dp-brl-badge')) return;
    const brl = window.__dp.cnyToBrl(el.dataset.dpCny);
    if (brl) badge.textContent = window.__dp.formatBrl(brl);
  });
};

// ── Módulos habilitados ───────────────────────────────────────────────────────

window.__dp.modulesEnabled = { converter: true, sizes: true, import: true, alerts: true };

chrome.storage.local.get('dpModules', ({ dpModules }) => {
  if (dpModules) window.__dp.modulesEnabled = { ...window.__dp.modulesEnabled, ...dpModules };
});

// ── Modo de exibição do preço convertido ────────────────────────────────────
// 'add' (padrão): mostra o badge BRL ao lado do preço CNY original.
// 'replace': esconde o preço CNY original e deixa só o valor em BRL — ver
// regra `.dp-replace-price` em styles.css. Aplicado via classe no <html> para
// não exigir mudanças nos scripts de conversão de cada site.
function applyDisplayMode(mode) {
  document.documentElement.classList.toggle('dp-replace-price', mode === 'replace');
}

chrome.storage.local.get('dpDisplayMode', ({ dpDisplayMode }) => applyDisplayMode(dpDisplayMode));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.dpDisplayMode) {
    applyDisplayMode(changes.dpDisplayMode.newValue);
  }
});

// ── MutationObserver helper ───────────────────────────────────────────────────

// Agrupa chamadas em rajada (ex.: MutationObserver disparando a cada item
// inserido em scroll infinito) numa só, `wait`ms depois da última mutação.
window.__dp.debounce = (fn, wait = 200) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, wait);
  };
};
