// ── Módulo genérico para sites CN (1688, Weidian, etc.) ──────────────────────
// Injeta conversão BRL nos preços e painel de estimativa de importação.

(function () {
  if (!window.__dp?.modulesEnabled?.converter) return;

  // Casa um texto que é EXATAMENTE "¥123.45" (ou "￥1,234"): símbolo + número,
  // nada mais. Em sites como o 1688, o preço costuma ser renderizado como
  // <div class="price--XXX">¥ 189<span class="priceText--YYY">¥ 189</span></div>
  // — tanto o wrapper quanto o filho batem no PRICE_SELECTORS e têm o mesmo
  // textContent, então sem a checagem de "filho candidato" os dois geravam
  // badges duplicados.
  const PRICE_FULL_RE = /^[¥￥]\s*[\d,]+(?:\.\d+)?$/;

  function parsePriceNumber(text) {
    const match = text.match(/[\d,]+(?:\.\d+)?/);
    if (!match) return null;
    // Remove TODAS as vírgulas (separador de milhar) — não apenas a primeira,
    // senão "1,234.56" virava "1.234.56" → parseFloat = 1.234 (errado).
    const cny = parseFloat(match[0].replace(/,/g, ''));
    return (!isNaN(cny) && cny > 0) ? cny : null;
  }

  function convertPriceEl(el) {
    if (el.dataset.dpDone) return;
    el.dataset.dpDone = '1';

    const cny = parsePriceNumber(el.textContent.trim());
    if (!cny) return;

    const brl = window.__dp.cnyToBrl(cny);
    if (!brl) return;

    const badge = document.createElement('span');
    badge.className = 'dp-brl-badge';
    badge.textContent = window.__dp.formatBrl(brl);
    el.insertAdjacentElement('afterend', badge);
  }

  // Seletores comuns a sites CN
  const PRICE_SELECTORS = [
    '[class*="price"]',
    '[class*="Price"]',
    '[class*="amount"]',
    '[class*="Amount"]',
    'em',
    'b',
    'strong',
  ].join(',');

  function scanPrices() {
    document.querySelectorAll(PRICE_SELECTORS).forEach((el) => {
      const text = el.textContent.trim();
      if (!PRICE_FULL_RE.test(text)) return;

      // Se um filho também é candidato (mesmo seletor) e tem o mesmo texto,
      // deixa o filho — mais específico — ser processado e pula este wrapper.
      const childCandidate = [...el.children].some((c) =>
        c.matches(PRICE_SELECTORS) && c.textContent.trim() === text,
      );
      if (childCandidate) return;

      convertPriceEl(el);
    });
  }

  // Roda inicial + observa mudanças (SPAs)
  setTimeout(scanPrices, 800);
  new MutationObserver(() => scanPrices())
    .observe(document.body, { childList: true, subtree: true });

  // ── Painel de estimativa de importação ──────────────────────────────────────

  function injectImportPanel(priceEl, cny) {
    if (priceEl.dataset.dpPanel) return;
    priceEl.dataset.dpPanel = '1';

    const FRETE_BRL = window.__dp.freightBrl ?? 30; // atualizado por common.js
    const TAX_THRESHOLD_USD = 50;
    const CNY_TO_USD = 1 / 7.15; // taxa fixa aproximada CNY→USD

    const productBrl = parseFloat(window.__dp.cnyToBrl(cny));
    const productUsd = cny * CNY_TO_USD;
    const hasTax     = productUsd > TAX_THRESHOLD_USD;
    const taxBrl     = hasTax ? productBrl * 0.6 : 0;
    const totalBrl   = productBrl + FRETE_BRL + taxBrl;

    const panel = document.createElement('div');
    panel.className = 'dp-import-panel';
    panel.innerHTML = `
      <h4>📦 Estimativa de importação</h4>
      <div class="dp-import-row"><span>Produto</span><span class="dp-import-val">${window.__dp.formatBrl(productBrl)}</span></div>
      <div class="dp-import-row"><span>Frete estimado</span><span class="dp-import-val">${window.__dp.formatBrl(FRETE_BRL)}</span></div>
      ${hasTax ? `<div class="dp-import-row"><span>Imposto (60%)</span><span class="dp-import-val" style="color:#f87171">${window.__dp.formatBrl(taxBrl)}</span></div>` : ''}
      <div class="dp-import-row dp-import-row--total"><span>Total estimado</span><span class="dp-import-val">${window.__dp.formatBrl(totalBrl)}</span></div>
      ${hasTax ? '<p class="dp-import-warning">⚠️ Produto acima de US$50 — sujeito a 60% de imposto + frete.</p>' : ''}
      <p class="dp-import-warning" style="color:#64748b">Estimativa. Valores reais podem variar.</p>
    `;
    priceEl.insertAdjacentElement('afterend', panel);
  }

  // Injeta painel no primeiro preço de destaque após 1s
  setTimeout(() => {
    const els = document.querySelectorAll(PRICE_SELECTORS);
    for (const el of els) {
      const text = el.textContent.trim();
      if (!PRICE_FULL_RE.test(text)) continue;

      // Mesma checagem de dedup do scanPrices(): pula wrappers cujo filho
      // tem o mesmo texto (o filho será avaliado em outra iteração).
      const childCandidate = [...el.children].some((c) =>
        c.matches(PRICE_SELECTORS) && c.textContent.trim() === text,
      );
      if (childCandidate) continue;

      const cny = parsePriceNumber(text);
      if (cny && cny > 5 && cny < 50000) {
        injectImportPanel(el, cny);
        break;
      }
    }
  }, 1200);
})();
