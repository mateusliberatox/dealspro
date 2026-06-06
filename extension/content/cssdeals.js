// ── CSSDeals ─────────────────────────────────────────────────────────────────
// Badge "Detectado pelo DealsPro" + botão para criar alerta.

(function () {
  if (!window.__dp) return;

  const DEALSPRO_URL = 'https://dealspro-chi.vercel.app';

  // Extrai itemid da URL atual ou de um link
  function getItemId(url = location.href) {
    const m = url.match(/[?&]itemid=(\d+)/);
    return m ? m[1] : null;
  }

  // ── Página de produto individual ─────────────────────────────────────────────

  async function handleProductPage() {
    const itemid = getItemId();
    if (!itemid) return;
    if (document.querySelector('.dp-detected-badge')) return;

    // Verifica se o produto existe no DealsPro
    chrome.runtime.sendMessage({ type: 'CHECK_PRODUCT', itemid }, (res) => {
      if (!res?.ok || !res.data?.found) return;

      const produto = res.data.produto;
      const timeAgo = relativeTime(produto.criado_em);

      // Badge de detecção
      const badge = document.createElement('div');
      badge.className = 'dp-detected-badge';
      badge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        DealsPro · detectado ${timeAgo}
        <a href="${DEALSPRO_URL}/go/${produto.id}" target="_blank"
           style="margin-left:6px;color:#93c5fd;text-decoration:none;font-size:10px">
          ver →
        </a>
      `;

      // Injeta após o título ou preço
      const anchor =
        document.querySelector('.mn-product-detail h4') ||
        document.querySelector('.mn-product-detail h5') ||
        document.querySelector('.mn-price') ||
        document.querySelector('h1');
      if (anchor) anchor.insertAdjacentElement('afterend', badge);

      // Botão de alerta (só se logado no DealsPro)
      if (!window.__dp.modulesEnabled.alerts) return;

      chrome.storage.local.get('dpToken', ({ dpToken }) => {
        if (!dpToken) return;
        const name = produto.nome_traduzido || produto.nome || '';

        const btn = document.createElement('button');
        btn.className = 'dp-float-btn';
        btn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Criar alerta no DealsPro
        `;
        btn.addEventListener('click', () => {
          const keyword = name.split(' ').slice(0, 3).join(' ');
          chrome.runtime.sendMessage({
            type:    'CREATE_ALERT',
            payload: { keyword, categoria: produto.categoria ?? null },
          }, (res2) => {
            if (res2?.ok) {
              btn.className = 'dp-float-btn dp-float-btn--success';
              btn.textContent = '✓ Alerta criado!';
              window.__dp.toast('Alerta criado no DealsPro!', 'success');
            } else if (res2?.error === 'not_logged_in') {
              window.__dp.toast('Faça login no DealsPro para criar alertas.', 'error');
            }
          });
        });

        badge.insertAdjacentElement('afterend', btn);
      });
    });
  }

  // ── Cards no feed (listagem) ──────────────────────────────────────────────────

  function handleFeedCards() {
    if (!window.__dp.modulesEnabled.alerts) return;

    document.querySelectorAll('.mn-product-card').forEach((card) => {
      if (card.dataset.dpDone) return;
      card.dataset.dpDone = '1';

      const link    = card.querySelector('a[href*="itemid="]');
      const itemid  = link ? getItemId(link.href) : null;
      if (!itemid) return;

      chrome.storage.local.get('dpToken', ({ dpToken }) => {
        if (!dpToken) return;

        const btn = document.createElement('button');
        btn.className = 'dp-float-btn dp-float-btn--small';
        btn.title = 'Criar alerta no DealsPro';
        btn.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          </svg>
          Alerta
        `;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const nameEl  = card.querySelector('.mn-product-detail h4 a, .mn-product-detail h5 a');
          const keyword = nameEl?.textContent?.trim()?.split(' ').slice(0, 3).join(' ') ?? '';
          chrome.runtime.sendMessage({
            type:    'CREATE_ALERT',
            payload: { keyword },
          }, (res) => {
            if (res?.ok) {
              btn.textContent = '✓';
              btn.className = 'dp-float-btn dp-float-btn--small dp-float-btn--success';
              window.__dp.toast(`Alerta criado: "${keyword}"`, 'success');
            }
          });
        });

        const priceEl = card.querySelector('.mn-price-new, .mn-price');
        if (priceEl) priceEl.insertAdjacentElement('afterend', btn);
      });
    });
  }

  // ── Utilitário de tempo relativo ──────────────────────────────────────────────

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m    = Math.floor(diff / 60_000);
    if (m < 1)  return 'agora';
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  const isProduct = /[?&]itemid=/.test(location.href);
  if (isProduct) {
    setTimeout(handleProductPage, 800);
  } else {
    let attempts = 0;
    const interval = setInterval(() => {
      handleFeedCards();
      if (++attempts > 10) clearInterval(interval);
    }, 600);

    new MutationObserver(handleFeedCards)
      .observe(document.body, { childList: true, subtree: true });
  }
})();
