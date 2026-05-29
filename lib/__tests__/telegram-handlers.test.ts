import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleStart,
  handleStatus,
  handleAlertas,
  handleCancelar,
  handleFeed,
  type TelegramCtx,
} from '../telegram-webhook-handlers.ts';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function createMockDb(profileData: Record<string, unknown> | null = null, alertsData: unknown[] = []) {
  const ops: Array<{ table: string; type: string; data?: unknown }> = [];

  function makeChain(table: string) {
    const filters: Record<string, unknown> = {};
    const q: Record<string, unknown> = {};
    q['select'] = () => makeChain(table);
    q['update'] = (data: unknown) => { ops.push({ table, type: 'update', data }); return q; };
    q['insert'] = (data: unknown) => { ops.push({ table, type: 'insert', data }); return Promise.resolve({ error: null }); };
    q['eq']     = (col: string, val: unknown) => { filters[col] = val; return q; };
    q['ilike']  = () => q;
    q['is']     = () => q;
    q['not']    = () => q;
    q['order']  = () => q;
    q['then']   = undefined;
    q['single'] = () => {
      if (table === 'user_alerts_dealspro') {
        return Promise.resolve({ data: alertsData[0] ?? null, error: null });
      }
      return Promise.resolve({ data: profileData, error: null });
    };
    // Para queries de lista (handleAlertas)
    q[Symbol.iterator as never] = undefined;
    q['data'] = alertsData;
    // Simula resolução como Promise para queries de lista
    Object.defineProperty(q, 'then', { value: undefined, writable: true });
    const queryAsPromise = () => Promise.resolve({ data: table === 'user_alerts_dealspro' ? alertsData : [profileData], error: null });
    (q as Record<string, unknown>)['_resolveList'] = queryAsPromise;
    return q;
  }

  return { ops, from: (table: string) => makeChain(table) };
}

function makeCtx(profileData: Record<string, unknown> | null = null, alertsData: unknown[] = []) {
  const replies: Array<{ chatId: number; text: string }> = [];
  const ctx: TelegramCtx = {
    db:    createMockDb(profileData, alertsData) as never,
    reply: mock.fn(async (chatId: number, text: string) => { replies.push({ chatId, text }); }),
  };
  return { ctx, replies };
}

// ── handleStart ───────────────────────────────────────────────────────────────

describe('handleStart', () => {
  test('sem payload: responde com mensagem de boas-vindas', async () => {
    const { ctx, replies } = makeCtx();
    await handleStart(ctx, 123, 'user', '');
    assert.equal(replies.length, 1);
    assert.ok(replies[0].text.includes('Bem-vindo'));
  });

  test('payload válido: vincula conta e confirma', async () => {
    const profile = { user_id: 'uuid-1', telegram_chat_id: null };
    const { ctx, replies } = makeCtx(profile);
    await handleStart(ctx, 456, 'user2', 'REF123');
    assert.equal(replies.length, 1);
    assert.ok(replies[0].text.includes('vinculada'));
    // Verifica que update foi chamado
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    assert.ok(db.ops.some((o) => o.type === 'update'));
  });

  test('payload inválido: responde com erro', async () => {
    const { ctx, replies } = makeCtx(null); // profile null = não encontrado
    await handleStart(ctx, 789, 'user3', 'INVALID');
    assert.ok(replies[0].text.includes('inválido'));
  });

  test('conta já vinculada ao mesmo chatId: confirma sem re-vincular', async () => {
    const chatId  = 111;
    const profile = { user_id: 'uuid-2', telegram_chat_id: chatId };
    const { ctx, replies } = makeCtx(profile);
    await handleStart(ctx, chatId, 'user4', 'REF456');
    assert.ok(replies[0].text.includes('já está vinculada'));
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    assert.equal(db.ops.filter((o) => o.type === 'update').length, 0);
  });
});

// ── handleStatus ──────────────────────────────────────────────────────────────

describe('handleStatus', () => {
  test('usuário free: exibe plano gratuito', async () => {
    const { ctx, replies } = makeCtx({ plan: 'free', plan_expires_at: null, telegram_notify_mode: 'alerts_only' });
    await handleStatus(ctx, 123);
    assert.ok(replies[0].text.includes('Gratuito'));
  });

  test('usuário premium: exibe plano premium', async () => {
    const { ctx, replies } = makeCtx({
      plan:              'premium',
      plan_expires_at:   new Date(Date.now() + 86_400_000).toISOString(),
      telegram_notify_mode: 'alerts_only',
    });
    await handleStatus(ctx, 123);
    assert.ok(replies[0].text.includes('Premium'));
  });

  test('conta não encontrada: responde com erro', async () => {
    const { ctx, replies } = makeCtx(null);
    await handleStatus(ctx, 999);
    assert.ok(replies[0].text.includes('não encontrada'));
  });
});

// ── handleFeed ────────────────────────────────────────────────────────────────

describe('handleFeed', () => {
  test('free + alerts_only → toggle para all_deals', async () => {
    const { ctx } = makeCtx({ user_id: 'u1', plan: 'free', telegram_notify_mode: 'alerts_only' });
    await handleFeed(ctx, 123);
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    const upd = db.ops.find((o) => o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['telegram_notify_mode'], 'all_deals');
  });

  test('premium + alerts_only → toggle para both', async () => {
    const { ctx } = makeCtx({ user_id: 'u2', plan: 'premium', telegram_notify_mode: 'alerts_only' });
    await handleFeed(ctx, 123);
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    const upd = db.ops.find((o) => o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['telegram_notify_mode'], 'both');
  });

  test('any mode ≠ alerts_only → toggle para alerts_only', async () => {
    const { ctx } = makeCtx({ user_id: 'u3', plan: 'premium', telegram_notify_mode: 'both' });
    await handleFeed(ctx, 123);
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    const upd = db.ops.find((o) => o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['telegram_notify_mode'], 'alerts_only');
  });
});

// ── handleCancelar ────────────────────────────────────────────────────────────

describe('handleCancelar', () => {
  test('keyword encontrada: desativa alerta', async () => {
    const alert = { id: 'alert-1', keyword: 'hoodie' };
    const { ctx } = makeCtx({ user_id: 'u4' }, [alert]);
    await handleCancelar(ctx, 123, 'hoodie');
    const db = ctx.db as unknown as ReturnType<typeof createMockDb>;
    assert.ok(db.ops.some((o) => o.type === 'update' && (o.data as Record<string, unknown>)['is_active'] === false));
  });

  test('keyword não encontrada: responde com erro', async () => {
    const { ctx, replies } = makeCtx({ user_id: 'u5' }, []);
    await handleCancelar(ctx, 123, 'nonexistent');
    assert.ok(replies[0].text.includes('Nenhum alerta'));
  });

  test('conta não vinculada: responde com erro', async () => {
    const { ctx, replies } = makeCtx(null);
    await handleCancelar(ctx, 999, 'hoodie');
    assert.ok(replies[0].text.includes('vinculada'));
  });
});
