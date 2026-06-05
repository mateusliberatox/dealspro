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
    options: [{
      name:        'plano',
      description: 'Escolha o plano (padrão: mensal)',
      type:        3,
      required:    false,
      choices: [
        { name: '📅 Mensal — R$ 9,99/mês',              value: 'mensal' },
        { name: '🏆 Anual — R$ 79,90/ano (2 meses grátis)', value: 'anual' },
      ],
    }],
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
    description: 'Monta uma declaração aduaneira com múltiplos produtos',
    options: [
      {
        name:        'valor',
        description: 'Valor total em USD a declarar (ex: 50). Se pagou em yuan, use moeda:yuan',
        type:        10,
        required:    true,
      },
      {
        name:        'moeda',
        description: 'Moeda do valor informado (padrão: USD)',
        type:        3,
        required:    false,
        choices: [
          { name: 'USD — dólar (padrão)', value: 'usd' },
          { name: 'Yuan (¥) — converte para USD automaticamente', value: 'yuan' },
        ],
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
  {
    name:        'avaliar-seller',
    description: 'Avalie um seller do CSSDeals',
    options: [
      {
        name:         'seller',
        description:  'Nome do seller (escolha da lista ou sugira um novo)',
        type:         3,
        required:     true,
        autocomplete: true,
      },
      {
        name:        'nota',
        description: 'Nota de 1 a 5',
        type:        4, // INTEGER
        required:    true,
        choices: [
          { name: '⭐ 1 — Péssimo',  value: 1 },
          { name: '⭐⭐ 2 — Ruim',   value: 2 },
          { name: '⭐⭐⭐ 3 — Ok',   value: 3 },
          { name: '⭐⭐⭐⭐ 4 — Bom',  value: 4 },
          { name: '⭐⭐⭐⭐⭐ 5 — Excelente', value: 5 },
        ],
      },
      {
        name:        'comentario',
        description: 'Comentário opcional (ex: entrega rápida, boa qualidade)',
        type:        3,
        required:    false,
      },
    ],
  },
  {
    name:        'seller',
    description: 'Veja as avaliações de um seller do CSSDeals',
    options: [
      {
        name:         'nome',
        description:  'Nome do seller',
        type:         3,
        required:     true,
        autocomplete: true,
      },
    ],
  },
  {
    name:        'aprovar-seller',
    description: '[Admin] Aprova ou rejeita um seller pendente',
    options: [
      {
        name:        'nome',
        description: 'Nome do seller a aprovar/rejeitar',
        type:        3,
        required:    true,
      },
      {
        name:        'acao',
        description: 'Ação a executar',
        type:        3,
        required:    true,
        choices: [
          { name: '✅ Aprovar',  value: 'aprovar' },
          { name: '❌ Rejeitar', value: 'rejeitar' },
        ],
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
