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
    name:        'declarar',
    description: 'Gera uma sugestão de declaração aduaneira para importação',
    options: [
      {
        name:        'produto',
        description: 'Nome do produto (ex: Nike Air Max 42 Preto)',
        type:        3,
        required:    true,
      },
      {
        name:        'valor',
        description: 'Valor declarado em USD (ex: 45.99)',
        type:        10, // NUMBER
        required:    true,
      },
      {
        name:        'quantidade',
        description: 'Quantidade de itens (padrão: 1)',
        type:        4, // INTEGER
        required:    false,
      },
    ],
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

  const appId   = process.env.DISCORD_APP_ID;
  const token   = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!appId || !token) {
    return NextResponse.json({ error: 'DISCORD_APP_ID ou DISCORD_BOT_TOKEN não configurados' }, { status: 500 });
  }

  // Guild commands aparecem instantaneamente; global commands levam até 1h para propagar.
  const endpoint = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const res = await fetch(endpoint, {
    method:  'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(COMMANDS),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });

  // Limpa comandos globais para evitar duplicatas (guild commands têm prioridade)
  if (guildId) {
    await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
      method:  'PUT',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([]),
    }).catch(() => {});
  }

  return NextResponse.json({ registered: (data as unknown[]).length, commands: (data as Array<{ name: string }>).map((c) => c.name) });
}
