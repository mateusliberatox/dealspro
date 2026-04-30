export interface Produto {
  id: number;
  nome: string;
  nome_traduzido: string | null;
  preco: string;
  link: string;
  imagem: string;
  categoria: string | null;
  sizes: string[];
  criado_em: string;
}

export interface DealsproProfile {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  is_admin: boolean;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  created_at: string;
}

export interface UserAlert {
  id: string;
  user_id: string;
  keyword: string;
  size: string | null;
  is_active: boolean;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  product_id: number;
  alert_id: string | null;
  channel: string;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  created_at: string;
}

export const CATEGORIES = [
  'Todos',
  'Smartwatch',
  'Bolsa / Mochila',
  'Roupas',
  'Eletrônicos',
  'Calçados',
  'Outros',
] as const;
