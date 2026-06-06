// ── Goofish / Xianyu ────────────────────────────────────────────────────────
// Mercado de usados chinês — foco em conversão de preço e painel de custo total.

(function () {
  if (!window.__dp) return;

  // ── Conversão de preços ──────────────────────────────────────────────────────

  function convertPrices() {
    if (!window.__dp.modulesEnabled.converter) return;

    const PRICE_SELECTORS = [
      '[class*="price"]', '[class*="Price"]',
      '[class*="amount"]', '[class*="Amount"]',
      '[class*="cost"]',   '[class*="Cost"]',
    ];

    document.querySelectorAll(PRICE_SELECTORS.join(',')).forEach((el) => {
      if (el.dataset.dpDone || el.children.length > 3) return;
      const text = el.textContent.trim();
      const num  = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(num) || num < 1 || num > 500000) return;
      if (!/[¥￥\d]/.test(text)) return;
      window.__dp.injectBrlBadge(el, num);
    });
  }

  // ── Melhoria visual nos cards de produto ─────────────────────────────────────
  // Goofish tem uma UI densa — destacamos condição do item e preço.

  function enhanceCards() {
    const cards = document.querySelectorAll(
      '[class*="card"], [class*="Card"], [class*="item"], [class*="Item"]'
    );

    cards.forEach((card) => {
      if (card.dataset.dpEnhanced) return;
      card.dataset.dpEnhanced = '1';

      // Procura texto de condição do item (novo, usado, etc.)
      const condText = card.textContent.match(/八|九|全新|近全新|7成新|6成新/);
      if (condText) {
        const chip = document.createElement('span');
        chip.style.cssText = [
          'display:inline-block',
          'padding:1px 6px',
          'border-radius:4px',
          'font-size:10px',
          'font-weight:700',
          'font-family:-apple-system,sans-serif',
          'background:rgba(245,158,11,0.15)',
          'border:1px solid rgba(245,158,11,0.3)',
          'color:#d97706',
          'margin-left:4px',
        ].join(';');
        chip.textContent = condText[0];
        const titleEl = card.querySelector('[class*="title"], [class*="Title"], h3, h4');
        if (titleEl && !titleEl.querySelector('.dp-cond-chip')) {
          chip.className = 'dp-cond-chip';
          titleEl.appendChild(chip);
        }
      }
    });
  }

  // ── Estimativa de custo total na página do produto ───────────────────────────

  function injectCostPanel() {
    if (document.querySelector('.dp-import-panel')) return;

    const priceSelectors = ['[class*="price"]', '[class*="Price"]', '[class*="amount"]'];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;

      const num = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
      if (isNaN(num) || num < 1) continue;

      const FRETE = 80;
      const brl   = parseFloat(window.__dp.cnyToBrl(num));
      const usd   = num * 0.14; // aprox
      const hasTax = usd > 50;
      const tax    = hasTax ? brl * 0.6 : 0;
      const total  = brl + FRETE + tax;

      const panel = document.createElement('div');
      panel.className = 'dp-import-panel';
      panel.innerHTML = `
        <h4><span class="dp-logo-inline">DEALS<b>PRO</b></span> · Custo total estimado</h4>
        <div class="dp-import-row"><span>Produto (usado)</span><span class="dp-import-val">${window.__dp.formatBrl(brl)}</span></div>
        <div class="dp-import-row"><span>Frete China→BR</span><span class="dp-import-val">${window.__dp.formatBrl(FRETE)}</span></div>
        ${hasTax ? `<div class="dp-import-row"><span>Imposto (60%)</span><span class="dp-import-val" style="color:#f87171">${window.__dp.formatBrl(tax)}</span></div>` : ''}
        <div class="dp-import-row dp-import-row--total"><span>Total</span><span class="dp-import-val">${window.__dp.formatBrl(total)}</span></div>
        ${hasTax ? '<p class="dp-import-warning">⚠️ Acima de US$50 — imposto de 60% aplicável.</p>' : ''}
        <p class="dp-import-warning" style="color:#475569;margin-top:4px">Estimativa. Frete varia por agente.</p>
      `;
      el.insertAdjacentElement('afterend', panel);
      break;
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  let attempts = 0;
  const tryInject = setInterval(() => {
    convertPrices();
    enhanceCards();
    if (window.location.pathname.includes('/item/') || window.location.pathname.includes('/detail/')) {
      injectCostPanel();
    }
    if (++attempts > 15) clearInterval(tryInject);
  }, 700);

  new MutationObserver(() => { convertPrices(); enhanceCards(); })
    .observe(document.body, { childList: true, subtree: true });
})();
