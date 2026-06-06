// GET /api/extension/product?itemid=123456
// Verifica se um produto do CSSDeals existe no DealsPro.
// Chamado pela extensão — sem autenticação necessária.

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const itemid = request.nextUrl.searchParams.get('itemid');

  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET',
    'Cache-Control':                'public, max-age=60',
  };

  if (!itemid || !/^\d+$/.test(itemid)) {
    return NextResponse.json({ found: false }, { headers });
  }

  const { data } = await db
    .from('produtos_dealspro')
    .select('id, nome, nome_traduzido, preco, categoria, criado_em, disponivel')
    .eq('cssdeals_item_id', itemid)
    .order('criado_em', { ascending: false })
    .limit(1)
    .single();

  if (!data) return NextResponse.json({ found: false }, { headers });

  return NextResponse.json({
    found:   true,
    produto: {
      id:             data.id,
      nome:           data.nome,
      nome_traduzido: data.nome_traduzido,
      preco:          data.preco,
      categoria:      data.categoria,
      criado_em:      data.criado_em,
      disponivel:     data.disponivel,
    },
  }, { headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  });
}
