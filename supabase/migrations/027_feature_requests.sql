-- Roadmap público com votos (página /sugestoes), inspirado na seção
-- "Próximas novidades" do ImportKit: lista de funcionalidades planejadas /
-- em desenvolvimento / concluídas, com contagem de votos por usuário logado.

CREATE TABLE IF NOT EXISTS feature_requests (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL UNIQUE,
  description TEXT,
  category    TEXT        NOT NULL DEFAULT 'geral',
  status      TEXT        NOT NULL DEFAULT 'planejado'
                CHECK (status IN ('planejado', 'em_desenvolvimento', 'concluido')),
  is_pro      BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1 voto por usuário por feature
CREATE TABLE IF NOT EXISTS feature_votes (
  id          SERIAL PRIMARY KEY,
  feature_id  INTEGER     NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_votes_feature ON feature_votes (feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests (status, sort_order);

-- RLS: leitura pública (roadmap é público); votos só pelo próprio usuário
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_requests_select_all" ON feature_requests
  FOR SELECT USING (true);

CREATE POLICY "feature_votes_select_all" ON feature_votes
  FOR SELECT USING (true);

CREATE POLICY "feature_votes_insert_own" ON feature_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feature_votes_delete_own" ON feature_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Seed inicial — itens já entregues (mostram momentum) + roadmap próximo,
-- baseado na pesquisa de mercado feita sobre o ImportKit (votos da
-- concorrência validam a prioridade destes itens).
INSERT INTO feature_requests (title, description, category, status, is_pro, sort_order) VALUES
  ('Calculadora de frete e impostos', 'Estime o frete real e o custo total de importação (produto + frete + imposto) por agente de compras e método de envio.', 'precos', 'concluido', false, 1),
  ('Vendedores confiáveis com avaliação', 'Lista de vendedores do Taobao/Goofish/Weidian avaliados pela comunidade, com nota e comentários.', 'vendedores', 'concluido', false, 2),
  ('Busca inteligente PT → 中文', 'Digite em português, a IA traduz e busca direto nos melhores sites chineses.', 'inteligencia', 'concluido', false, 3),
  ('Suporte completo ao Taobao', 'Conversor de preços, painel de custo total e vendedores recomendados também no Taobao, com paridade ao Goofish.', 'plataforma', 'em_desenvolvimento', false, 4),
  ('Comparador de preços Brasil x China', 'Compare o preço de um produto entre marketplaces brasileiros e sites chineses para ver se vale a pena importar.', 'precos', 'planejado', true, 5),
  ('Rede social de avaliações de vendedores', 'Qualquer usuário pode avaliar e comentar vendedores do Goofish e Taobao direto pelo site, sem precisar do Discord.', 'vendedores', 'planejado', false, 6),
  ('Classificação automática de vendedores', 'IA classifica vendedores por qualidade, reputação e histórico de avaliações — encontre os melhores automaticamente.', 'vendedores', 'planejado', true, 7),
  ('Rastreio + impostos automáticos', 'Acompanhe encomendas e pague o imposto de importação automaticamente, tudo integrado em um só lugar.', 'logistica', 'planejado', true, 8)
ON CONFLICT (title) DO NOTHING;
