// ── Goofish / Xianyu ────────────────────────────────────────────────────────

(function () {
  if (!window.__dp) return;

  // Extrai número válido de um texto (¥ ou só número)
  function extractCny(text) {
    const clean = text.replace(/[^\d.]/g, '');
    const num   = parseFloat(clean);
    return (!isNaN(num) && num >= 1 && num <= 999999) ? num : null;
  }

  // Casa um texto que é EXATAMENTE "¥123.45" (símbolo + número, nada mais).
  // O Goofish costuma renderizar o preço como
  // <div class="...price..."><span class="...symbol">¥</span><span class="...number">50</span></div>
  // — o textContent do wrapper bate com este regex, mas nem o span do símbolo
  // (sem dígitos) nem o do número (sem ¥) batem isoladamente.
  const PRICE_FULL_RE = /^[¥￥]\s*[\d,]+(?:\.\d+)?$/;

  // ── Conversão de preços ──────────────────────────────────────────────────────

  function convertPrices() {
    if (!window.__dp.modulesEnabled.converter) return;

    const SELECTORS = [
      '[class*="price"]', '[class*="Price"]',
      '[class*="amount"]', '[class*="Amount"]',
    ];
    const selectorStr = SELECTORS.join(',');

    document.querySelectorAll(selectorStr).forEach((el) => {
      // Já processado ou já tem badge ao lado
      if (el.dataset.dpDone) return;
      if (el.nextElementSibling?.classList.contains('dp-brl-badge')) return;

      const text = el.textContent.trim();
      if (!PRICE_FULL_RE.test(text)) return;

      // Se um filho também é candidato (ex.: span do número) e tem o mesmo
      // valor, deixa o filho — mais específico — ser processado e pula este
      // wrapper. Evita badge duplicado no pai E no filho.
      const childCandidate = [...el.children].some((c) =>
        c.matches(selectorStr) && PRICE_FULL_RE.test(c.textContent.trim()),
      );
      if (childCandidate) return;

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
      // Marca como visto imediatamente — o seletor acima bate com ~25% dos
      // elementos da página (incluindo wrappers/seções grandes), e em sites
      // de scroll infinito o MutationObserver dispara o tempo todo. Marcar
      // antes de qualquer trabalho garante que cada elemento seja inspecionado
      // no máximo uma vez.
      card.dataset.dpEnhanced = '1';

      // Contêineres com muitos filhos diretos costumam ser seções/listas
      // inteiras, não um "card" individual — pula antes do textContent
      // (que percorre toda a subárvore e é caro nesses casos).
      if (card.children.length > 12) return;

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
    // Antes, este painel era injetado independente do toggle "Estimativa de
    // importação" no popup — o módulo `import` não tinha nenhum efeito.
    if (!window.__dp.modulesEnabled.import) return;
    if (document.querySelector('.dp-import-panel')) return;

    const SELECTORS = ['[class*="price"]','[class*="Price"]','[class*="amount"]'];
    const selectorStr = SELECTORS.join(',');
    for (const sel of SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        const text = el.textContent.trim();
        if (!PRICE_FULL_RE.test(text)) continue;

        // Mesma checagem de convertPrices(): se um filho também bate com o
        // padrão "¥123" e é candidato pelo seletor, deixa o filho ser usado.
        const childCandidate = [...el.children].some((c) =>
          c.matches(selectorStr) && PRICE_FULL_RE.test(c.textContent.trim()),
        );
        if (childCandidate) continue;

        const cny = extractCny(text);
        if (!cny || cny < 5) continue;

        const FRETE   = window.__dp.freightBrl ?? 30;
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

  // ── Avaliações de sellers ─────────────────────────────────────────────────────

  function extractSellerName() {
    // Mais específico primeiro: classes "...Name" são quase sempre o nome da
    // loja/vendedor. Os genéricos "user"/"nick" ficam por último porque
    // também batem em ícones de usuário/menu de navegação no topo da página
    // e podiam acabar pegando o nome/avatar do PRÓPRIO usuário logado.
    const SELS = [
      '[class*="shopName"]',  '[class*="ShopName"]',
      '[class*="sellerName"]','[class*="SellerName"]',
      '[class*="storeName"]', '[class*="StoreName"]',
      '[class*="shop"]',  '[class*="Shop"]',
      '[class*="seller"]','[class*="Seller"]',
      '[class*="store"]', '[class*="Store"]',
      '[class*="nick"]',  '[class*="Nick"]',
      '[class*="user"]',  '[class*="User"]',
    ];
    for (const sel of SELS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = el.textContent?.trim();
      if (text && text.length > 1 && text.length < 60) return text;
    }
    return null;
  }

  function injectSellerRating() {
    if (document.querySelector('.dp-seller-badge')) return;
    const name = extractSellerName();
    if (!name) return;

    chrome.runtime.sendMessage({ type: 'GET_SELLER', name }, (res) => {
      if (!res?.ok || !res.data?.found) return;
      const s = res.data.seller;

      const STARS = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];
      const color = s.avg >= 4 ? '#16a34a' : s.avg >= 3 ? '#d97706' : '#dc2626';

      const badge = document.createElement('div');
      badge.className = 'dp-seller-badge';
      badge.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:6px',
        'padding:5px 10px', 'border-radius:8px', 'margin-top:8px',
        'background:rgba(15,23,42,0.85)', 'border:1px solid rgba(59,130,246,0.3)',
        'font-family:-apple-system,sans-serif',
      ].join(';');

      badge.innerHTML = `
        <span style="font-size:10px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:0.05em">DealsPro</span>
        <span style="font-size:13px;color:${color}">${STARS[Math.round(s.avg)]}</span>
        <span style="font-size:11px;font-weight:700;color:#f1f5f9">${s.avg}/5</span>
        <span style="font-size:10px;color:#64748b">(${s.total} av.)</span>
        ${s.recent?.[0]?.comentario
          ? `<span style="font-size:10px;color:#94a3b8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"${s.recent[0].comentario}"</span>`
          : ''}
      `;

      // Injeta próximo ao nome do seller (mesma ordem de prioridade do
      // extractSellerName — específico antes de genérico)
      const anchor = document.querySelector(
        '[class*="shopName"],[class*="ShopName"],[class*="sellerName"],[class*="SellerName"],' +
        '[class*="storeName"],[class*="StoreName"],[class*="shop"],[class*="Shop"],' +
        '[class*="seller"],[class*="Seller"],[class*="store"],[class*="Store"],' +
        '[class*="nick"],[class*="Nick"],[class*="user"],[class*="User"]',
      );
      if (anchor) anchor.insertAdjacentElement('afterend', badge);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  let attempts = 0;
  const isProduct = /\/(item|detail|product)\//.test(location.pathname)
    || /[?&]id=/.test(location.search);

  const interval = setInterval(() => {
    convertPrices();
    enhanceCards();
    if (isProduct) { injectCostPanel(); injectSellerRating(); }
    if (++attempts > 20) clearInterval(interval);
  }, 700);

  // Debounced: scroll infinito dispara o callback do MutationObserver a cada
  // item inserido — agrupa em uma única passada por janela de 200ms.
  const onMutate = window.__dp.debounce(() => { convertPrices(); enhanceCards(); }, 200);
  new MutationObserver(onMutate)
    .observe(document.body, { childList: true, subtree: true });
})();
