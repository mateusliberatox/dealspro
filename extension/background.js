// ── Service Worker ──────────────────────────────────────────────────────────
// Busca a cotação CNY→BRL a cada hora e armazena no chrome.storage.local.
// Os content scripts leem daqui sem precisar fazer chamadas externas.

importScripts('shared/config.js');

const RATE_TTL_MS  = 60 * 60 * 1000; // 1 hora
const DEALSPRO_URL = 'https://dealspro-chi.vercel.app';

// Mesmas credenciais públicas (anon key) usadas em popup/popup.js — necessárias
// aqui para renovar a sessão (refresh token) quando uma chamada autenticada
// (CREATE_ALERT) recebe 401 com o popup fechado.
const SUPABASE_URL  = DP_CONFIG.SUPABASE_URL;
const SUPABASE_ANON = DP_CONFIG.SUPABASE_ANON;

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
  // Se o usuário definiu uma cotação manual (ver popup/popup.js, página
  // Config), ela tem prioridade sobre a cotação automática — útil quando a
  // API está fora do ar ou o usuário quer ser conservador. Os content
  // scripts e o popup continuam lendo apenas `cnyToBrl`, sem mudanças.
  const { dpManualRate } = await chrome.storage.local.get('dpManualRate');
  if (dpManualRate) {
    await chrome.storage.local.set({
      cnyToBrl:      dpManualRate,
      rateUpdatedAt: Date.now(),
      rateIsManual:  true,
    });
    return;
  }

  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/CNY');
    const data = await res.json();
    const brl  = data?.rates?.BRL;
    const usd  = data?.rates?.USD;
    if (!brl) return;

    await chrome.storage.local.set({
      cnyToBrl:     brl,
      cnyToUsd:     usd ?? (1 / 7.15),
      rateUpdatedAt: Date.now(),
      rateIsManual: false,
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
      sendResponse({ rate: cnyToBrl ?? DP_CONFIG.FALLBACK_RATE });
    });
    return true; // mantém canal aberto para resposta async
  }

  // Força a reavaliação imediata da cotação (ignora o TTL de 1h) — usado
  // pelo popup quando o usuário define/remove a cotação manual em Config.
  if (msg.type === 'REFRESH_RATE') {
    fetchRate().then(async () => {
      const { cnyToBrl, rateIsManual } = await chrome.storage.local.get(['cnyToBrl', 'rateIsManual']);
      sendResponse({ rate: cnyToBrl ?? DP_CONFIG.FALLBACK_RATE, manual: !!rateIsManual });
    });
    return true;
  }

  if (msg.type === 'CHECK_PRODUCT') {
    fetch(`${DEALSPRO_URL}/api/extension/product?itemid=${msg.itemid}`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (r) => sendResponse({ ok: r.ok, data: await r.json() }))
      .catch(() => sendResponse({ ok: false, error: 'network' }));
    return true;
  }

  if (msg.type === 'GET_SELLER') {
    fetch(`${DEALSPRO_URL}/api/extension/seller?name=${encodeURIComponent(msg.name)}`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (r) => sendResponse({ ok: r.ok, data: await r.json() }))
      .catch(() => sendResponse({ ok: false, error: 'network' }));
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

        const data = await res.json().catch(() => null);
        // Antes, qualquer resposta (mesmo 400/500) virava `ok: true` e o
        // popup mostrava "Alerta criado!" mesmo quando a API recusou o
        // pedido (ex.: alerta duplicado, payload inválido).
        sendResponse({ ok: res.ok, data });
      } catch {
        sendResponse({ ok: false, error: 'network' });
      }
    });
    return true;
  }
});
