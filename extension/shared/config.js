// ── Configuração compartilhada ──────────────────────────────────────────────
// Carregado antes de background.js, content scripts e popup.js.
// Content scripts/service worker/popup rodam em contextos isolados e não
// compartilham módulos ES — este arquivo é incluído via manifest.json
// (content_scripts) e <script>/importScripts (popup/background) para evitar
// duplicar estas constantes.

const DP_CONFIG = {
  SUPABASE_URL:  'https://ktgypsgwxumdobakyebn.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lwc2d3eHVtZG9iYWt5ZWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDczNDQsImV4cCI6MjA5MDEyMzM0NH0.ySFLxVz5bII76bu2TTrnNOc0LbmjmT_WI974zvqjO9o',
  // Câmbio de fallback CNY→BRL, usado enquanto a cotação real (GET_RATE) não chega.
  FALLBACK_RATE: 0.82,
};
