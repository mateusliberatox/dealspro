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

// Verifica sessão salva
chrome.storage.local.get(['dpToken', 'dpEmail', 'dpPlan'], ({ dpToken, dpEmail, dpPlan }) => {
  if (dpToken && dpEmail) showAccount(dpEmail, dpPlan ?? 'free');
});

// Login
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('emailInput').value.trim();
  const pass  = document.getElementById('passInput').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!email || !pass) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Entrando…';
  btn.disabled    = true;

  try {
    const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body:    JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error_description ?? 'E-mail ou senha incorretos.';
      errEl.style.display = 'block';
      return;
    }

    const token = data.access_token;
    const userId = data.user?.id;

    // Busca plano do usuário
    let plan = 'free';
    if (userId) {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/dealspro_profiles?user_id=eq.${userId}&select=plan&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } },
      );
      const profiles = await profileRes.json();
      plan = profiles?.[0]?.plan ?? 'free';
    }

    await chrome.storage.local.set({ dpToken: token, dpEmail: email, dpPlan: plan });
    showAccount(email, plan);
  } catch (e) {
    errEl.textContent = 'Erro de conexão. Tente novamente.';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Entrar';
    btn.disabled    = false;
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['dpToken', 'dpEmail', 'dpPlan'], showLogin);
});
