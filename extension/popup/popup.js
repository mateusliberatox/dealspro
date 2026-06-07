// ── DealsPro Extension Popup ─────────────────────────────────────────────────

const SUPABASE_URL  = 'https://ktgypsgwxumdobakyebn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lwc2d3eHVtZG9iYWt5ZWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDczNDQsImV4cCI6MjA5MDEyMzM0NH0.ySFLxVz5bII76bu2TTrnNOc0LbmjmT_WI974zvqjO9o';

// ── Tabela de tarifas de frete por agente (CNY por pacote, destino: Brasil) ──
// base: taxa fixa de envio (CNY)
// perKg: taxa por kg adicional acima do peso mínimo (CNY/kg)
// minKg: peso mínimo cobrado
// Fonte: calculadoras públicas dos agentes (valores aproximados, atualizar periodicamente)
const AGENTS = {
  cssbuy: {
    name: 'CSBuy', url: 'https://www.cssbuy.com/estimates',
    methods: {
      'Economy (E-Packet BR)': { base: 28,  perKg: 22, minKg: 0.1 },
      'Standard (YunExpress)': { base: 48,  perKg: 32, minKg: 0.1 },
      'EMS':                   { base: 70,  perKg: 48, minKg: 0.1 },
      'DHL Express':           { base: 120, perKg: 75, minKg: 0.5 },
    },
  },
  pandabuy: {
    name: 'Pandabuy', url: 'https://www.pandabuy.com/freight-estimate',
    methods: {
      'Economy Line':          { base: 30,  perKg: 20, minKg: 0.1 },
      'Standard (YunExpress)': { base: 50,  perKg: 35, minKg: 0.1 },
      'EMS':                   { base: 75,  perKg: 50, minKg: 0.1 },
      'DHL Express':           { base: 130, perKg: 80, minKg: 0.5 },
    },
  },
  sugargoo: {
    name: 'Sugargoo', url: 'https://www.sugargoo.com/#/home/freightEstimate',
    methods: {
      'Economy (E-Packet)':    { base: 26,  perKg: 20, minKg: 0.1 },
      'Standard (4PX)':        { base: 45,  perKg: 30, minKg: 0.1 },
      'EMS':                   { base: 68,  perKg: 46, minKg: 0.1 },
      'DHL Express':           { base: 118, perKg: 72, minKg: 0.5 },
    },
  },
  superbuy: {
    name: 'Superbuy', url: 'https://www.superbuy.com/en/page/freightestimate/',
    methods: {
      'Economy Line':          { base: 32,  perKg: 22, minKg: 0.1 },
      'Standard (YunExpress)': { base: 52,  perKg: 36, minKg: 0.1 },
      'EMS':                   { base: 78,  perKg: 52, minKg: 0.1 },
      'DHL Express':           { base: 125, perKg: 78, minKg: 0.5 },
    },
  },
  wegobuy: {
    name: 'Wegobuy', url: 'https://www.wegobuy.com/en/page/freightestimate/',
    methods: {
      'Economy Line':          { base: 30,  perKg: 21, minKg: 0.1 },
      'Standard (4PX)':        { base: 48,  perKg: 33, minKg: 0.1 },
      'EMS':                   { base: 72,  perKg: 48, minKg: 0.1 },
      'DHL Express':           { base: 120, perKg: 74, minKg: 0.5 },
    },
  },
  custom: {
    name: 'Personalizado', url: '',
    methods: { 'Personalizado': { base: 0, perKg: 0, minKg: 0 } },
  },
};

// ── Cotação ──────────────────────────────────────────────────────────────────

let currentRate = 0.82;
chrome.storage.local.get(['cnyToBrl', 'rateUpdatedAt'], ({ cnyToBrl }) => {
  const chip = document.getElementById('rateChip');
  if (cnyToBrl) {
    currentRate = cnyToBrl;
    chip.textContent = `1 ¥ = R$ ${cnyToBrl.toFixed(4)}`;
  } else {
    chip.textContent = 'Sem cotação';
  }
});

// ── Tema ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get('dpTheme', ({ dpTheme }) => {
  if (dpTheme === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('themeBtn').textContent = '🌙';
  }
});

document.getElementById('themeBtn').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('themeBtn').textContent = dark ? '🌙' : '☀️';
  chrome.storage.local.set({ dpTheme: dark ? 'dark' : 'light' });
});

// ── Nav footer ────────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`page-${btn.dataset.page}`).classList.add('active');
  });
});

// ── Tamanhos ──────────────────────────────────────────────────────────────────

document.querySelectorAll('.size-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.size-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.size-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`size-${tab.dataset.size}`).classList.add('active');
  });
});

// ── Toggle global ─────────────────────────────────────────────────────────────

chrome.storage.local.get('dpEnabled', ({ dpEnabled }) => {
  document.getElementById('globalToggle').checked = dpEnabled !== false;
});
document.getElementById('globalToggle').addEventListener('change', (e) => {
  chrome.storage.local.set({ dpEnabled: e.target.checked });
});

// ── Módulos ───────────────────────────────────────────────────────────────────

chrome.storage.local.get('dpModules', ({ dpModules }) => {
  const mods = dpModules ?? { converter: true, sizes: true, import: true, alerts: true };
  document.querySelectorAll('.feature-card[data-mod]').forEach((card) => {
    if (mods[card.dataset.mod] === false) card.classList.remove('active');
    else card.classList.add('active');
  });
});

document.querySelectorAll('.feature-card[data-mod]').forEach((card) => {
  card.addEventListener('click', () => {
    const isPremiumCard = !!card.querySelector('.badge-premium');
    if (isPremiumCard) {
      chrome.storage.local.get('dpPlan', ({ dpPlan }) => {
        if (dpPlan !== 'premium') {
          chrome.tabs.create({ url: 'https://dealspro-chi.vercel.app/upgrade' });
          return;
        }
        toggleCard(card);
      });
      return;
    }
    toggleCard(card);
  });
});

function toggleCard(card) {
  card.classList.toggle('active');
  chrome.storage.local.get('dpModules', ({ dpModules }) => {
    const curr = dpModules ?? {};
    curr[card.dataset.mod] = card.classList.contains('active');
    chrome.storage.local.set({ dpModules: curr });
  });
}

// ── Busca inteligente PT→ZH ───────────────────────────────────────────────────
// Chama a API direto do popup — evita depender do service worker (MV3 dorme)

const DEALSPRO_API = 'https://dealspro-chi.vercel.app';

const SEARCH_URLS = {
  taobao:  (q) => `https://s.taobao.com/search?q=${encodeURIComponent(q)}`,
  goofish: (q) => `https://www.goofish.com/search?q=${encodeURIComponent(q)}`,
  '1688':  (q) => `https://s.1688.com/selloffer/offerlist.htm?keywords=${encodeURIComponent(q)}`,
};

document.getElementById('searchBtn').addEventListener('click', async () => {
  const text    = document.getElementById('searchInput').value.trim();
  const site    = document.getElementById('searchSite').value;
  const result  = document.getElementById('searchResult');
  const errEl   = document.getElementById('searchError');
  const transEl = document.getElementById('searchTranslated');
  const btn     = document.getElementById('searchBtn');

  if (!text) return;
  errEl.style.display = 'none'; result.style.display = 'none';
  btn.textContent = '…'; btn.disabled = true;

  try {
    const res  = await fetch(`${DEALSPRO_API}/api/extension/translate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    if (!res.ok || !data.translated) throw new Error('sem tradução');

    transEl.textContent  = data.translated;
    result.style.display = 'block';
    chrome.tabs.create({ url: SEARCH_URLS[site]?.(data.translated) ?? SEARCH_URLS.taobao(data.translated) });
  } catch {
    errEl.textContent = 'Falha na tradução. Verifique sua conexão.';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Buscar'; btn.disabled = false;
  }
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// ── Rastreamento — chama a API diretamente do popup ───────────────────────────

document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.page === 'orders') loadOrders();
  });
});

async function loadOrders() {
  const wrap = document.getElementById('ordersWrap');
  wrap.innerHTML = '<p style="font-size:11px;color:var(--text3);text-align:center;padding:20px 0">Carregando…</p>';

  const { dpToken } = await chrome.storage.local.get('dpToken');
  if (!dpToken) {
    wrap.innerHTML = '<p style="font-size:11px;color:var(--text3);text-align:center;padding:16px 0">Faça login para ver seus pedidos.</p>';
    return;
  }

  try {
    const res    = await fetch(`${DEALSPRO_API}/api/extension/orders`, {
      headers: { Authorization: `Bearer ${dpToken}` },
      signal:  AbortSignal.timeout(8_000),
    });
    const data   = await res.json();
    const orders = data?.orders ?? [];

    if (!orders.length) {
      wrap.innerHTML = '<p style="font-size:11px;color:var(--text3);text-align:center;padding:16px 0">Nenhuma encomenda em trânsito.</p>';
      return;
    }

    wrap.innerHTML = orders.map((o) => `
      <div style="padding:9px 10px;border-radius:9px;background:var(--bg2);border:1px solid var(--border);margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.description}</span>
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--accent-bg);color:var(--accent);white-space:nowrap;flex-shrink:0">${o.statusLabel}</span>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px">${o.code}</div>
        ${o.lastEvent ? `<div style="font-size:10px;color:var(--text2);margin-top:4px">↳ ${o.lastEvent}</div>` : ''}
      </div>
    `).join('');
  } catch {
    wrap.innerHTML = '<p style="font-size:11px;color:#ef4444;text-align:center;padding:16px 0">Erro ao carregar. Tente novamente.</p>';
  }
}

// ── Configurações de frete ────────────────────────────────────────────────────

const agentSel  = document.getElementById('agentSelect');
const methodSel = document.getElementById('methodSelect');
const weightSel = document.getElementById('weightSelect');
const customGrp = document.getElementById('customGroup');
const customInp = document.getElementById('customFreight');
const calcLink  = document.getElementById('agentCalcLink');

function buildMethodOptions(agentKey) {
  const agent = AGENTS[agentKey];
  methodSel.innerHTML = '';
  Object.keys(agent.methods).forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    methodSel.appendChild(opt);
  });
  calcLink.href = agent.url || '#';
  calcLink.style.display = agent.url ? 'block' : 'none';
  customGrp.style.display = agentKey === 'custom' ? 'block' : 'none';
}

function calcFreight(agentKey, methodName, weightGrams) {
  if (agentKey === 'custom') {
    const val = parseFloat(customInp.value) || 80;
    return { cny: null, brl: val };
  }
  const method = AGENTS[agentKey]?.methods[methodName];
  if (!method) return { cny: 80, brl: 80 * currentRate };
  const kg    = Math.max(method.minKg, weightGrams / 1000);
  const cny   = method.base + method.perKg * (kg - method.minKg);
  return { cny: Math.round(cny), brl: parseFloat((cny * currentRate).toFixed(2)) };
}

function updatePreview() {
  const agentKey  = agentSel.value;
  const method    = methodSel.value;
  const weightG   = parseInt(weightSel.value);
  const freight   = calcFreight(agentKey, method, weightG);

  const TAX_THRESH_USD = 50;
  // Produto fictício de R$ 150 para mostrar exemplo
  const prodBrl = 150;
  const prodUsd = prodBrl / 5.8;
  const hasTax  = prodUsd > TAX_THRESH_USD;
  const taxBrl  = hasTax ? prodBrl * 0.6 : 0;
  const totalBrl = prodBrl + freight.brl + taxBrl;

  const rows = document.getElementById('shippingRows');
  rows.innerHTML = `
    <div class="shipping-row"><span>Produto (ex: R$ 150,00)</span><span>R$ 150,00</span></div>
    <div class="shipping-row">
      <span>Frete ${freight.cny ? `(¥${freight.cny} × câmbio)` : '(personalizado)'}</span>
      <span>R$ ${freight.brl.toFixed(2).replace('.', ',')}</span>
    </div>
    <div class="shipping-row"><span>Imposto (ex, prod. > US$50)</span><span style="color:#ef4444">R$ ${taxBrl.toFixed(2).replace('.', ',')}</span></div>
    <div class="shipping-row"><span>Total estimado</span><span>R$ ${totalBrl.toFixed(2).replace('.', ',')}</span></div>
  `;

  // Salva configuração + valor calculado para uso nos content scripts
  chrome.storage.local.set({
    dpShipping:   { agent: agentKey, method, weightG, customBrl: parseFloat(customInp.value) || 80 },
    dpShippingBrl: freight.brl,
  });
}

// Carrega configuração salva
chrome.storage.local.get('dpShipping', ({ dpShipping }) => {
  const cfg = dpShipping ?? { agent: 'cssbuy', method: 'Economy (E-Packet BR)', weightG: 500, customBrl: 80 };
  agentSel.value  = cfg.agent  ?? 'cssbuy';
  weightSel.value = cfg.weightG ?? 500;
  customInp.value = cfg.customBrl ?? 80;
  buildMethodOptions(agentSel.value);
  // Seleciona método salvo
  for (const opt of methodSel.options) {
    if (opt.value === cfg.method) { opt.selected = true; break; }
  }
  updatePreview();
});

agentSel.addEventListener('change',  () => { buildMethodOptions(agentSel.value); updatePreview(); });
methodSel.addEventListener('change', updatePreview);
weightSel.addEventListener('change', updatePreview);
customInp.addEventListener('input',  updatePreview);

// ── Auth helpers ──────────────────────────────────────────────────────────────

function showAccount(email, plan) {
  document.getElementById('login-section').style.display   = 'none';
  document.getElementById('account-section').style.display = 'block';
  document.getElementById('accountEmail').textContent = email || '—';
  document.getElementById('accountPlan').textContent  =
    plan === 'premium' ? '★ Premium ativo' : 'Plano Free';
  const av = document.getElementById('accountAvatar');
  if (av && email) av.textContent = email.charAt(0).toUpperCase();
  const dot = document.getElementById('statusDot');
  dot.textContent = plan === 'premium' ? '★ Premium' : 'Conectado';
  dot.className   = 'status-dot connected';
}

function showLogin() {
  document.getElementById('login-section').style.display   = 'block';
  document.getElementById('account-section').style.display = 'none';
  const dot = document.getElementById('statusDot');
  dot.textContent = 'Sem login'; dot.className = 'status-dot disconnected';
}

async function finishLogin(accessToken) {
  const errEl = document.getElementById('loginError');
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON },
    });
    const user = await userRes.json();
    if (!user?.id) throw new Error('Inválido');
    const profRes  = await fetch(
      `${SUPABASE_URL}/rest/v1/dealspro_profiles?user_id=eq.${user.id}&select=plan&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } },
    );
    const plan = (await profRes.json())?.[0]?.plan ?? 'free';
    await chrome.storage.local.set({ dpToken: accessToken, dpEmail: user.email, dpPlan: plan });
    showAccount(user.email, plan);
  } catch {
    errEl.textContent = 'Erro ao obter dados. Tente novamente.';
    errEl.style.display = 'block';
  }
}

// ── Discord OAuth ─────────────────────────────────────────────────────────────

document.getElementById('discordBtn').addEventListener('click', () => {
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('discordBtn');
  errEl.style.display = 'none'; btn.textContent = 'Abrindo Discord…'; btn.disabled = true;
  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?` + new URLSearchParams({
    provider: 'discord', redirect_to: redirectUrl, scopes: 'identify email',
  });
  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 127.14 96.36" fill="white"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg> Entrar com Discord`;
    btn.disabled = false;
    if (chrome.runtime.lastError || !responseUrl) { errEl.textContent = 'Login cancelado.'; errEl.style.display = 'block'; return; }
    try {
      const url   = new URL(responseUrl);
      const hash  = new URLSearchParams(url.hash.slice(1));
      const query = new URLSearchParams(url.search);
      const token = hash.get('access_token') || query.get('access_token');
      if (!token) throw new Error('Token não encontrado');
      await finishLogin(token);
    } catch { errEl.textContent = 'Erro no login. Tente novamente.'; errEl.style.display = 'block'; }
  });
});

// ── Email/senha ───────────────────────────────────────────────────────────────

document.getElementById('toggleEmailBtn').addEventListener('click', () => {
  const form = document.getElementById('emailForm');
  const btn  = document.getElementById('toggleEmailBtn');
  const open = form.style.display !== 'block';
  form.style.display = open ? 'block' : 'none';
  btn.textContent    = open ? '✉️ Entrar com e-mail ▴' : '✉️ Entrar com e-mail ▾';
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('emailInput').value.trim();
  const pass  = document.getElementById('passInput').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = 'block'; return; }
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Entrando…'; btn.disabled = true;
  try {
    const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error_description ?? 'E-mail ou senha incorretos.'; errEl.style.display = 'block'; return; }
    await finishLogin(data.access_token);
  } catch { errEl.textContent = 'Erro de conexão.'; errEl.style.display = 'block'; }
  finally { btn.textContent = 'Entrar'; btn.disabled = false; }
});

// ── Sessão salva + logout ─────────────────────────────────────────────────────

chrome.storage.local.get(['dpToken', 'dpEmail', 'dpPlan'], ({ dpToken, dpEmail, dpPlan }) => {
  if (dpToken && dpEmail) showAccount(dpEmail, dpPlan ?? 'free');
  else showLogin();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['dpToken', 'dpEmail', 'dpPlan'], showLogin);
});
