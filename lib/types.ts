export interface Produto {
  id: number;
  nome: string;
  nome_traduzido: string | null;
  preco: string;
  link: string;
  imagem: string;
  categoria: string | null;
  criado_em: string;
}

export interface DealsproProfile {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  is_admin: boolean;
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
