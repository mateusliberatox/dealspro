// ── Service Worker ──────────────────────────────────────────────────────────
// Busca a cotação CNY→BRL a cada hora e armazena no chrome.storage.local.
// Os content scripts leem daqui sem precisar fazer chamadas externas.

const RATE_TTL_MS  = 60 * 60 * 1000; // 1 hora
const DEALSPRO_URL = 'https://dealspro-chi.vercel.app';

// Mesmas credenciais públicas (anon key) usadas em popup/popup.js — necessárias
// aqui para renovar a sessão (refresh token) quando uma chamada autenticada
// (CREATE_ALERT) recebe 401 com o popup fechado.
const SUPABASE_URL  = 'https://ktgypsgwxumdobakyebn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lwc2d3eHVtZG9iYWt5ZWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDczNDQsImV4cCI6MjA5MDEyMzM0NH0.ySFLxVz5bII76bu2TTrnNOc0LbmjmT_WI974zvqjO9o';

// NOTA: 0.82 (linha do fallback de GET_RATE abaixo) também aparece em
// content/common.js e popup/popup.js. Mantenha os 3 sincronizados.

async function refreshDpToken(refreshToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body:    JSON.stringify({ refresh_token: refreshToken }),
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token ? data : null;
  } catch {
    return null;
  }
}

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
    fetch(`${DEALSPRO_URL}/api/extension/product?itemid=${msg.itemid}`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'GET_SELLER') {
    fetch(`${DEALSPRO_URL}/api/extension/seller?name=${encodeURIComponent(msg.name)}`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'CREATE_ALERT') {
    chrome.storage.local.get(['dpToken', 'dpRefreshToken']).then(async ({ dpToken, dpRefreshToken }) => {
      if (!dpToken) { sendResponse({ ok: false, error: 'not_logged_in' }); return; }

      const doFetch = (token) => fetch(`${DEALSPRO_URL}/api/extension/alert`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(msg.payload),
      });

      try {
        let res = await doFetch(dpToken);

        // Token expirado e popup fechado (sem o refresh feito ali) — tenta
        // renovar aqui antes de desistir.
        if (res.status === 401 && dpRefreshToken) {
          const refreshed = await refreshDpToken(dpRefreshToken);
          if (refreshed) {
            await chrome.storage.local.set({
              dpToken: refreshed.access_token,
              dpRefreshToken: refreshed.refresh_token ?? dpRefreshToken,
            });
            res = await doFetch(refreshed.access_token);
          }
        }

        if (res.status === 401) { sendResponse({ ok: false, error: 'not_logged_in' }); return; }

        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch {
        sendResponse({ ok: false, error: 'network' });
      }
    });
    return true;
  }
});
