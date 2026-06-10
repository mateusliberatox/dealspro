// ── Taobao / Tmall ───────────────────────────────────────────────────────────

(function () {
  if (!window.__dp) return;

  // ── Conversão de preços ──────────────────────────────────────────────────────

  // Casa um texto que é EXATAMENTE "¥123.45" (símbolo + número, nada mais).
  // Mesmo padrão usado em goofish.js / cn-common.js: o preço pode estar todo
  // num nó de texto direto OU dividido em spans (símbolo/número separados),
  // então comparamos o textContent inteiro do elemento contra o regex em vez
  // de só os nós de texto diretos.
  const PRICE_FULL_RE = /^[¥￥]\s*[\d,]+(?:\.\d+)?$/;

  function convertPrices() {
    if (!window.__dp.modulesEnabled.converter) return;

    const SELECTORS = '[class*="price"], [class*="Price"], [class*="priceText"], [class*="priceWrap"], em, strong';

    document.querySelectorAll(SELECTORS).forEach((el) => {
      if (el.dataset.dpDone) return;
      if (el.nextElementSibling?.classList.contains('dp-brl-badge')) return;

      const text = el.textContent.trim();
      if (!PRICE_FULL_RE.test(text)) return;

      // Se um filho também é candidato e tem o mesmo texto, deixa o filho —
      // mais específico — ser processado e pula este wrapper (evita badge
      // duplicado no pai E no filho).
      const childCandidate = [...el.children].some((c) =>
        c.matches(SELECTORS) && c.textContent.trim() === text,
      );
      if (childCandidate) return;

      const num = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(num) || num < 1 || num > 999999) return;

      window.__dp.injectBrlBadge(el, num);
    });
  }

  // ── Guia de tamanhos ─────────────────────────────────────────────────────────

  const SIZE_DATA = {
    roupas: [
      ['XS', 'PP', '155/80A', '155–158 cm'],
      ['S',  'P',  '160/84A', '159–162 cm'],
      ['M',  'M',  '165/88A', '163–166 cm'],
      ['L',  'G',  '170/92A', '167–170 cm'],
      ['XL', 'GG', '175/96A', '171–174 cm'],
      ['2XL','XGG','180/100A','175–178 cm'],
      ['3XL','3GG','185/108A','179+ cm'],
    ],
    calcados: [
      ['35','34–35','3','2'],
      ['36','35–36','4','3'],
      ['37','36–37','4.5','3.5'],
      ['38','37–38','5.5','4.5'],
      ['39','38–39','6.5','5.5'],
      ['40','39–40','7','6'],
      ['41','40–41','8','7'],
      ['42','41–42','9','8'],
      ['43','42–43','10','9'],
      ['44','43–44','11','10'],
      ['45','44–45','12','11'],
    ],
  };

  function buildSizeGuide() {
    const div = document.createElement('div');
    div.className = 'dp-size-guide';
    div.innerHTML = `
      <h4><span class="dp-logo-inline">DEALS<b>PRO</b></span> · Guia de Tamanhos</h4>
      <p style="margin:0 0 8px;font-size:11px;color:#64748b">Tamanhos chineses → equivalente BR</p>
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Roupas</p>
      <table class="dp-size-table">
        <thead><tr><th>CN</th><th>BR</th><th>Etiqueta</th><th>Altura</th></tr></thead>
        <tbody>${SIZE_DATA.roupas.map(([cn,br,et,alt]) =>
          `<tr><td>${cn}</td><td>${br}</td><td>${et}</td><td>${alt}</td></tr>`).join('')}
        </tbody>
      </table>
      <p style="margin:10px 0 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase">Calçados (EU = BR)</p>
      <table class="dp-size-table">
        <thead><tr><th>CN</th><th>EU/BR</th><th>US M</th><th>US F</th></tr></thead>
        <tbody>${SIZE_DATA.calcados.map(([cn,eu,usm,usf]) =>
          `<tr><td>${cn}</td><td>${eu}</td><td>${usm}</td><td>${usf}</td></tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:8px;font-size:10px;color:#475569">⚠️ Medidas variam por marca. Sempre verifique a tabela do vendedor.</p>
    `;
    return div;
  }

  function injectSizeGuide() {
    if (!window.__dp.modulesEnabled.sizes) return;
    if (document.querySelector('.dp-size-guide')) return;

    // Procura container de tamanhos do produto
    const skuSelectors = [
      '[class*="SkuItem"]', '[class*="skuItem"]',
      '[class*="sizeItem"]', '[class*="SizeItem"]',
      '[class*="propertyItem"]',
    ];

    let anchor = null;
    for (const sel of skuSelectors) {
      const el = document.querySelector(sel)?.closest('[class*="sku"], [class*="Sku"], [class*="property"]');
      if (el) { anchor = el; break; }
    }

    if (anchor) {
      anchor.insertAdjacentElement('afterend', buildSizeGuide());
    }
  }

  // ── Avaliações de sellers ─────────────────────────────────────────────────────

  function injectSellerRating() {
    if (document.querySelector('.dp-seller-badge')) return;
    const SELS = ['[class*="shopName"]','[class*="ShopName"]','[class*="sellerName"]','[class*="shop"]','[class*="seller"]'];
    let name = null;
    for (const sel of SELS) {
      const text = document.querySelector(sel)?.textContent?.trim();
      if (text && text.length > 1 && text.length < 60) { name = text; break; }
    }
    if (!name) return;

    chrome.runtime.sendMessage({ type: 'GET_SELLER', name }, (res) => {
      if (!res?.ok || !res.data?.found) return;
      const s = res.data.seller;
      const STARS = ['','★','★★','★★★','★★★★','★★★★★'];
      const color = s.avg >= 4 ? '#16a34a' : s.avg >= 3 ? '#d97706' : '#dc2626';
      const badge = document.createElement('div');
      badge.className = 'dp-seller-badge';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;margin-top:8px;background:rgba(15,23,42,0.85);border:1px solid rgba(59,130,246,0.3);font-family:-apple-system,sans-serif';
      badge.innerHTML = `<span style="font-size:10px;font-weight:700;color:#60a5fa">DealsPro</span><span style="font-size:13px;color:${color}">${STARS[Math.round(s.avg)]}</span><span style="font-size:11px;font-weight:700;color:#f1f5f9">${s.avg}/5</span><span style="font-size:10px;color:#64748b">(${s.total})</span>`;
      for (const sel of SELS) {
        const el = document.querySelector(sel);
        if (el) { el.insertAdjacentElement('afterend', badge); break; }
      }
    });
  }

  // Roda após SPA carregar o produto
  const isProductPage = /[?&]id=/.test(location.search) || location.pathname.includes('/item');
  let attempts = 0;
  const tryInject = setInterval(() => {
    convertPrices();
    injectSizeGuide();
    if (isProductPage) injectSellerRating();
    if (++attempts > 10) clearInterval(tryInject);
  }, 600);

  new MutationObserver(() => convertPrices())
    .observe(document.body, { childList: true, subtree: true });
})();
