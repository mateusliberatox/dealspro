// Shared types for the Node.js scraper / notifier side (src/).

export interface Category {
  name: string;
  id:   number;
}

/** Raw product extracted from the page before DB enrichment. */
export interface ScrapedProduct {
  nome:             string;
  preco:            string;
  link:             string;
  imagem:           string;
  isSoldOut?:       boolean;
  sizes:            string[];
  cssdeals_item_id: string | null;
}

/** Full product shape after insertion / enrichment. */
export interface Product extends ScrapedProduct {
  id?:             string | number;
  nome_traduzido?: string | null;
  categoria?:      string | null;
  hash?:           string;
  visible_at?:     string;
  free_notified?:  boolean;
  disponivel?:     boolean;
  criado_em?:      string;
}

export interface Alert {
  id:        string | number;
  user_id:   string;
  keyword?:  string | null;
  size?:     string | null;
  categoria?: string | null;
}

export interface Profile {
  user_id:              string;
  plan:                 'free' | 'premium';
  discord_user_id?:     string | null;
  telegram_chat_id?:    number | null;
  telegram_notify_mode?: string | null;
}

export interface DiscordEmbed {
  color:        number;
  author:       { name: string };
  title:        string;
  url:          string;
  description?: string;
  image?:       { url: string };
  fields:       Array<{ name: string; value: string; inline?: boolean }>;
  footer:       { text: string };
  timestamp:    string;
}
