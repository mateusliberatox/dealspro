import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);

  const { data, error } = await supabase
    .from('produtos')
    .select('id, nome, preco, link, imagem, categoria, criado_em')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ total: data.length, produtos: data });
}
