// ── Popup Script ─────────────────────────────────────────────────────────────

const SUPABASE_URL    = 'https://ktgypsgwxumdobakyebn.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lwc2d3eHVtZG9iYWt5ZWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDczNDQsImV4cCI6MjA5MDEyMzM0NH0.ySFLxVz5bII76bu2TTrnNOc0LbmjmT_WI974zvqjO9o';

// ── Cotação ──────────────────────────────────────────────────────────────────

chrome.storage.local.get(['cnyToBrl', 'rateUpdatedAt'], ({ cnyToBrl, rateUpdatedAt }) => {
  const chip = document.getElementById('rateChip');
  if (cnyToBrl) {
    chip.textContent = `1 CNY = R$ ${cnyToBrl.toFixed(4)}`;
    const age = rateUpdatedAt ? Math.round((Date.now() - rateUpdatedAt) / 60_000) : null;
    if (age !== null) chip.title = `Atualizado há ${age} min`;
  } else {
    chip.textContent = 'Sem cotação';
  }
});

// ── Tabs principais ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Tabs de tamanho ──────────────────────────────────────────────────────────

document.querySelectorAll('.size-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.size-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.size-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`size-${tab.dataset.size}`).classList.add('active');
  });
});

// ── Módulos ──────────────────────────────────────────────────────────────────

const MODULES = ['converter', 'sizes', 'import', 'alerts'];

chrome.storage.local.get('dpModules', ({ dpModules }) => {
  const enabled = dpModules ?? { converter: true, sizes: true, import: true, alerts: true };
  MODULES.forEach((mod) => {
    const el = document.getElementById(`mod-${mod}`);
    if (el) el.checked = enabled[mod] !== false;
  });
});

MODULES.forEach((mod) => {
  const el = document.getElementById(`mod-${mod}`);
  if (!el) return;
  el.addEventListener('change', () => {
    chrome.storage.local.get('dpModules', ({ dpModules }) => {
      const curr = dpModules ?? {};
      curr[mod]  = el.checked;
      chrome.storage.local.set({ dpModules: curr });
    });
  });
});

// ── Autenticação ─────────────────────────────────────────────────────────────

async function finishLogin(accessToken) {
  const errEl = document.getElementById('loginError');
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON },
    });
    const user = await userRes.json();
    if (!user?.id) throw new Error('Usuário inválido');

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/dealspro_profiles?user_id=eq.${user.id}&select=plan&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } },
    );
    const profiles = await profileRes.json();
    const plan = profiles?.[0]?.plan ?? 'free';

    await chrome.storage.local.set({ dpToken: accessToken, dpEmail: user.email, dpPlan: plan });
    showAccount(user.email, plan);
  } catch (e) {
    errEl.textContent = 'Erro ao obter dados da conta.';
    errEl.style.display = 'block';
  }
}

// ── Login com Discord (OAuth via chrome.identity) ────────────────────────────

function showAccount(email, plan) {
  document.getElementById('login-section').style.display   = 'none';
  document.getElementById('account-section').style.display = 'block';
  document.getElementById('accountEmail').textContent = email;
  document.getElementById('accountPlan').textContent  = plan === 'premium' ? '★ Premium' : 'Plano Free';
}

function showLogin() {
  document.getElementById('login-section').style.display   = 'block';
  document.getElementById('account-section').style.display = 'none';
}

// ── Botão Discord ────────────────────────────────────────────────────────────

document.getElementById('discordBtn').addEventListener('click', () => {
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('discordBtn');
  errEl.style.display = 'none';
  btn.textContent = 'Abrindo Discord…';
  btn.disabled = true;

  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl = `${SUPABASE_URL}/auth/v1/authorize?` + new URLSearchParams({
    provider:    'discord',
    redirect_to: redirectUrl,
    scopes:      'identify email',
  });

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="white"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg> Entrar com Discord`;
    btn.disabled = false;

    if (chrome.runtime.lastError || !responseUrl) {
      errEl.textContent = 'Login cancelado.';
      errEl.style.display = 'block';
      return;
    }

    try {
      const url        = new URL(responseUrl);
      const hash       = new URLSearchParams(url.hash.slice(1));
      const query      = new URLSearchParams(url.search);
      const token      = hash.get('access_token') || query.get('access_token');
      if (!token) throw new Error('Token não encontrado');
      await finishLogin(token);
    } catch (e) {
      errEl.textContent = 'Erro no login. Tente novamente.';
      errEl.style.display = 'block';
    }
  });
});

// ── Verifica sessão salva ─────────────────────────────────────────────────────

// Verifica sessão salva
chrome.storage.local.get(['dpToken', 'dpEmail', 'dpPlan'], ({ dpToken, dpEmail, dpPlan }) => {
  if (dpToken && dpEmail) showAccount(dpEmail, dpPlan ?? 'free');
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['dpToken', 'dpEmail', 'dpPlan'], showLogin);
});
