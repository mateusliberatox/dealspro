// ── Service Worker ──────────────────────────────────────────────────────────
// Busca a cotação CNY→BRL a cada hora e armazena no chrome.storage.local.
// Os content scripts leem daqui sem precisar fazer chamadas externas.

const RATE_TTL_MS  = 60 * 60 * 1000; // 1 hora
const DEALSPRO_URL = 'https://dealspro-chi.vercel.app';

async function fetchRate() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/CNY');
    const data = await res.json();
    const brl  = data?.rates?.BRL;
    if (!brl) return;

    await chrome.storage.local.set({
      cnyToBrl:     brl,
      rateUpdatedAt: Date.now(),
    });
    console.log('[DealsPro] Cotação atualizada: 1 CNY = R$', brl.toFixed(4));
  } catch (e) {
    console.warn('[DealsPro] Falha ao buscar cotação:', e.message);
  }
}

async function maybeRefreshRate() {
  const { rateUpdatedAt } = await chrome.storage.local.get('rateUpdatedAt');
  if (!rateUpdatedAt || Date.now() - rateUpdatedAt > RATE_TTL_MS) {
    await fetchRate();
  }
}

// Atualiza ao instalar/iniciar
chrome.runtime.onInstalled.addListener(fetchRate);
chrome.runtime.onStartup.addListener(fetchRate);

// Atualiza a cada hora via alarm
chrome.alarms.create('refreshRate', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshRate') fetchRate();
});

// Responde mensagens dos content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_RATE') {
    maybeRefreshRate().then(async () => {
      const { cnyToBrl } = await chrome.storage.local.get('cnyToBrl');
      sendResponse({ rate: cnyToBrl ?? 0.82 }); // fallback razoável
    });
    return true; // mantém canal aberto para resposta async
  }

  if (msg.type === 'CHECK_PRODUCT') {
    fetch(`${DEALSPRO_URL}/api/extension/product?itemid=${msg.itemid}`)
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'GET_SELLER') {
    fetch(`${DEALSPRO_URL}/api/extension/seller?name=${encodeURIComponent(msg.name)}`)
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'CREATE_ALERT') {
    chrome.storage.local.get('dpToken').then(({ dpToken }) => {
      if (!dpToken) { sendResponse({ ok: false, error: 'not_logged_in' }); return; }
      fetch(`${DEALSPRO_URL}/api/extension/alert`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dpToken}` },
        body:    JSON.stringify(msg.payload),
      })
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch(() => sendResponse({ ok: false, error: 'network' }));
    });
    return true;
  }
});
