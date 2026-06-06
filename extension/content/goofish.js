// ── Goofish / Xianyu ────────────────────────────────────────────────────────

(function () {
  if (!window.__dp) return;

  // Retorna apenas o texto direto do nó (sem herdar de filhos)
  function directText(el) {
    let t = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) t += node.textContent;
    }
    return t.trim();
  }

  // Extrai número válido de um texto (¥ ou só número)
  function extractCny(text) {
    const clean = text.replace(/[^\d.]/g, '');
    const num   = parseFloat(clean);
    return (!isNaN(num) && num >= 1 && num <= 999999) ? num : null;
  }

  // ── Conversão de preços ──────────────────────────────────────────────────────

  function convertPrices() {
    if (!window.__dp.modulesEnabled.converter) return;

    const SELECTORS = [
      '[class*="price"]', '[class*="Price"]',
      '[class*="amount"]', '[class*="Amount"]',
    ];

    document.querySelectorAll(SELECTORS.join(',')).forEach((el) => {
      // Já processado ou já tem badge ao lado
      if (el.dataset.dpDone) return;
      if (el.nextElementSibling?.classList.contains('dp-brl-badge')) return;

      // Usa apenas texto direto — ignora herança de filhos
      const text = directText(el);

      // Deve conter explicitamente ¥ ou ￥ no texto direto
      if (!/[¥￥]/.test(text)) return;

      const cny = extractCny(text);
      if (!cny) return;

      window.__dp.injectBrlBadge(el, cny);
    });
  }

  // ── Chips de condição nos cards ──────────────────────────────────────────────

  const COND_MAP = {
    '全新':  { label: 'Novo',    color: '#15803d', bg: 'rgba(21,128,61,0.1)'  },
    '近全新': { label: '~Novo',   color: '#15803d', bg: 'rgba(21,128,61,0.08)' },
    '九成新': { label: '90%',     color: '#0369a1', bg: 'rgba(3,105,161,0.1)'  },
    '八成新': { label: '80%',     color: '#d97706', bg: 'rgba(217,119,6,0.1)'  },
    '七成新': { label: '70%',     color: '#d97706', bg: 'rgba(217,119,6,0.1)'  },
    '6成新':  { label: '60%',     color: '#dc2626', bg: 'rgba(220,38,38,0.1)'  },
  };

  function enhanceCards() {
    const cards = document.querySelectorAll(
      '[class*="card"],[class*="Card"],[class*="item"],[class*="Item"]'
    );

    cards.forEach((card) => {
      if (card.dataset.dpEnhanced) return;
      card.dataset.dpEnhanced = '1';

      const text = card.textContent;
      for (const [key, cfg] of Object.entries(COND_MAP)) {
        if (text.includes(key)) {
          const chip = document.createElement('span');
          chip.className = 'dp-cond-chip';
          chip.style.cssText = [
            'display:inline-block', 'padding:1px 5px', 'border-radius:4px',
            'font-size:9px', 'font-weight:700', `color:${cfg.color}`,
            `background:${cfg.bg}`, 'margin-left:4px', 'vertical-align:middle',
          ].join(';');
          chip.textContent = cfg.label;

          const titleEl = card.querySelector('[class*="title"],[class*="Title"],h3,h4');
          if (titleEl && !titleEl.querySelector('.dp-cond-chip')) {
            titleEl.appendChild(chip);
          }
          break;
        }
      }
    });
  }

  // ── Painel de estimativa na página do produto ─────────────────────────────────

  function injectCostPanel() {
    if (document.querySelector('.dp-import-panel')) return;

    const SELECTORS = ['[class*="price"]','[class*="Price"]','[class*="amount"]'];
    for (const sel of SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        const text = directText(el);
        if (!/[¥￥]/.test(text)) continue;

        const cny = extractCny(text);
        if (!cny || cny < 5) continue;

        const FRETE   = 80;
        const brl     = parseFloat(window.__dp.cnyToBrl(cny));
        const usdApprox = cny * 0.14;
        const hasTax  = usdApprox > 50;
        const tax     = hasTax ? brl * 0.6 : 0;
        const total   = brl + FRETE + tax;

        const panel = document.createElement('div');
        panel.className = 'dp-import-panel';
        panel.innerHTML = `
          <h4><span class="dp-logo-inline">DEALS<b>PRO</b></span> · Custo total estimado</h4>
          <div class="dp-import-row">
            <span>Produto</span>
            <span class="dp-import-val">${window.__dp.formatBrl(brl)}</span>
          </div>
          <div class="dp-import-row">
            <span>Frete China→BR (estimado)</span>
            <span class="dp-import-val">${window.__dp.formatBrl(FRETE)}</span>
          </div>
          ${hasTax ? `
          <div class="dp-import-row">
            <span>Imposto (60%)</span>
            <span class="dp-import-val" style="color:#f87171">${window.__dp.formatBrl(tax)}</span>
          </div>` : ''}
          <div class="dp-import-row dp-import-row--total">
            <span>Total estimado</span>
            <span class="dp-import-val">${window.__dp.formatBrl(total)}</span>
          </div>
          ${hasTax ? '<p class="dp-import-warning">⚠️ Acima de US$50 — imposto de 60% provável.</p>' : ''}
          <p class="dp-import-warning" style="color:#475569;margin-top:4px">Valores estimados. Frete e imposto podem variar.</p>
        `;
        el.insertAdjacentElement('afterend', panel);
        return;
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  let attempts = 0;
  const isProduct = /\/(item|detail|product)\//.test(location.pathname)
    || /[?&]id=/.test(location.search);

  const interval = setInterval(() => {
    convertPrices();
    enhanceCards();
    if (isProduct) injectCostPanel();
    if (++attempts > 20) clearInterval(interval);
  }, 700);

  new MutationObserver(() => { convertPrices(); enhanceCards(); })
    .observe(document.body, { childList: true, subtree: true });
})();
