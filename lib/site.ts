/**
 * URL canônica do site. Lê `NEXT_PUBLIC_SITE_URL` em build/runtime, com fallback
 * para o domínio atual de produção. Quando trocar de domínio, basta setar
 * o env var na Vercel — sem rebuild necessário em runtime do servidor.
 *
 * Use em server components, client components, route handlers e metadata.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dealspro-chi.vercel.app';
