// POST /api/admin/register-discord-commands
// Registra todos os slash commands do bot no servidor Discord.
// Chamar uma vez após adicionar novos comandos.
// Protegido por x-cron-secret (mesma chave do cron).

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const COMMANDS = [
  {
    name:        'assinar',
    description: 'Assine o DealsPro Premium',
  },
  {
    name:        'status',
    description: 'Veja seu plano atual',
  },
  {
    name:        'meus-alertas',
    description: 'Lista seus alertas de produtos ativos',
  },
  {
    name:        'cancelar',
    description: 'Desativa um alerta de produto',
    options: [{
      name:        'keyword',
      description: 'Keyword do alerta a cancelar',
      type:        3,
      required:    true,
    }],
  },
  {
    name:        'rastrear',
    description: 'Adiciona uma encomenda para rastreamento automático',
    options: [
      {
        name:        'codigo',
        description: 'Código de rastreamento (ex: AB123456789BR)',
        type:        3,
        required:    true,
      },
      {
        name:        'descricao',
        description: 'Descrição do item (ex: Nike Air Max 42 Preto)',
        type:        3,
        required:    false,
      },
    ],
  },
  {
    name:        'pedidos',
    description: 'Lista suas encomendas em rastreamento',
  },
  {
    name:        'remover-pedido',
    description: 'Remove uma encomenda do rastreamento',
    options: [{
      name:        'codigo',
      description: 'Código de rastreamento a remover',
      type:        3,
      required:    true,
    }],
  },
  {
    name:        'alterar-descricao',
    description: 'Altera a descrição de uma encomenda cadastrada',
    options: [
      {
        name:        'codigo',
        description: 'Código de rastreamento (ex: AB123456789BR)',
        type:        3,
        required:    true,
      },
      {
        name:        'descricao',
        description: 'Nova descrição (ex: Nike Air Max 42 Preto)',
        type:        3,
        required:    true,
      },
    ],
  },
];

export async function POST(request: NextRequest) {
  const secret   = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;

  if (!secret || !expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !token) {
    return NextResponse.json({ error: 'DISCORD_APP_ID ou DISCORD_BOT_TOKEN não configurados' }, { status: 500 });
  }

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method:  'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(COMMANDS),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });

  return NextResponse.json({ registered: (data as unknown[]).length, commands: (data as Array<{ name: string }>).map((c) => c.name) });
}
