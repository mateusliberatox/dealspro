export interface Produto {
  id: number;
  nome: string;
  nome_traduzido: string | null;
  preco: string;
  link: string;
  imagem: string;
  categoria: string | null;
  sizes: string[];
  visible_at: string;
  criado_em: string;
  disponivel: boolean;
}

// Colunas que o Feed/Hero realmente usam. Importar nesta constante em queries
// pra evitar select('*') — economiza IO budget significativo no Supabase.
export const PRODUTO_COLS = 'id, nome, nome_traduzido, preco, link, imagem, categoria, sizes, visible_at, criado_em, disponivel';

export interface DealsproProfile {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  is_admin: boolean;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  telegram_notify_mode: 'alerts_only' | 'all_deals' | 'both' | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
}

export interface UserAlert {
  id: string;
  user_id: string;
  keyword: string;
  size: string | null;
  categoria: string | null;
  is_active: boolean;
  created_at: string;
}

export const CATEGORIES = [
  'Todos',
  'Roupas',
  'Calçados',
  'Bolsa / Mochila',
  'Acessórios',
  'Smartwatch',
  'Eletrônicos',
  'Outros',
] as const;
