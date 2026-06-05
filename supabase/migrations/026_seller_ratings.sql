-- Sellers: nomes canônicos com fila de aprovação
CREATE TABLE IF NOT EXISTS sellers (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('approved', 'pending', 'rejected')),
  created_by  TEXT,          -- discord_user_id de quem sugeriu
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avaliações individuais (1 por usuário por seller)
CREATE TABLE IF NOT EXISTS seller_ratings (
  id               SERIAL PRIMARY KEY,
  seller_id        INTEGER     NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  discord_user_id  TEXT        NOT NULL,
  nota             SMALLINT    NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, discord_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sellers_name          ON sellers        (lower(name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_sellers_status        ON sellers        (status);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller ON seller_ratings (seller_id);
