import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleChargeRefunded,
  type StripeHandlerDeps,
} from '../stripe-webhook-handlers.ts';
import type Stripe from 'stripe';

// ── Mock Supabase builder ─────────────────────────────────────────────────────

interface MockOp { table: string; type: 'update' | 'insert'; data: unknown; filters: Record<string, unknown> }

function createMockDb(rowsByTable: Record<string, Record<string, unknown> | null> = {}) {
  const ops: MockOp[] = [];

  function makeChain(table: string) {
    const filters: Record<string, unknown> = {};
    const q: Record<string, unknown> = {};
    q['select'] = () => makeChain(table);
    q['update'] = (data: unknown) => { ops.push({ table, type: 'update', data, filters: { ...filters } }); return makeChain(table); };
    q['insert'] = (data: unknown) => { ops.push({ table, type: 'insert', data, filters: {} }); return Promise.resolve({ error: null }); };
    q['eq']     = (col: string, val: unknown) => { filters[col] = val; return q; };
    q['is']     = () => q;
    q['not']    = () => q;
    q['single'] = () => Promise.resolve({ data: rowsByTable[table] ?? null, error: null });
    q['then']   = undefined;
    return q;
  }

  return { ops, from: (table: string) => makeChain(table) };
}

function noop() { return Promise.resolve(); }

// ── checkout.session.completed ────────────────────────────────────────────────

describe('handleCheckoutCompleted', () => {
  test('assinatura Stripe: ativa premium e grava subscriptionId', async () => {
    const db        = createMockDb({ dealspro_profiles: { discord_user_id: null, referred_by: null, is_admin: false, stripe_customer_id: null } });
    const addRole   = mock.fn(noop);
    const session   = {
      client_reference_id: 'user-123',
      mode:                'subscription',
      customer:            'cus_abc',
      subscription:        'sub_xyz',
      metadata:            {},
    } as unknown as Stripe.Checkout.Session;
    const deps: StripeHandlerDeps = {
      db: db as never,
      addPremiumRole:       addRole,
      removePremiumRole:    mock.fn(noop),
      retrieveSubscription: mock.fn(async () => ({ current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 })) as never,
    };

    await handleCheckoutCompleted(session, deps);

    const upd = db.ops.find((o) => o.table === 'dealspro_profiles' && o.type === 'update');
    assert.ok(upd, 'deve ter gravado update em dealspro_profiles');
    assert.equal((upd!.data as Record<string, unknown>)['plan'], 'premium');
    assert.equal((upd!.data as Record<string, unknown>)['stripe_subscription_id'], 'sub_xyz');
  });

  test('PIX: ativa premium com plan_expires_at +30 dias', async () => {
    const db      = createMockDb({ dealspro_profiles: { discord_user_id: null, referred_by: null, is_admin: false, stripe_customer_id: null } });
    const session = {
      client_reference_id: 'user-pix',
      mode:                'payment',
      customer:            'cus_pix',
      subscription:        null,
      metadata:            { payment_type: 'pix' },
    } as unknown as Stripe.Checkout.Session;
    const deps: StripeHandlerDeps = {
      db: db as never,
      addPremiumRole:       mock.fn(noop),
      removePremiumRole:    mock.fn(noop),
      retrieveSubscription: mock.fn(noop) as never,
    };

    await handleCheckoutCompleted(session, deps);

    const upd = db.ops.find((o) => o.table === 'dealspro_profiles' && o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['plan'], 'premium');
    assert.equal((upd!.data as Record<string, unknown>)['stripe_subscription_id'], null);
    const expiresAt = new Date((upd!.data as Record<string, unknown>)['plan_expires_at'] as string);
    const diffDays  = (expiresAt.getTime() - Date.now()) / 86_400_000;
    assert.ok(diffDays > 29 && diffDays < 31, `plan_expires_at deve ser ~30 dias: ${diffDays}`);
  });

  test('Discord role é adicionado quando usuário tem discord_user_id', async () => {
    const db      = createMockDb({ dealspro_profiles: { discord_user_id: 'disc-456', referred_by: null, is_admin: false, stripe_customer_id: null } });
    const addRole = mock.fn(noop);
    const session = {
      client_reference_id: 'user-disc',
      mode:                'subscription',
      customer:            'cus_d',
      subscription:        'sub_d',
      metadata:            {},
    } as unknown as Stripe.Checkout.Session;
    const deps: StripeHandlerDeps = {
      db: db as never,
      addPremiumRole:       addRole,
      removePremiumRole:    mock.fn(noop),
      retrieveSubscription: mock.fn(async () => ({ current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 })) as never,
    };

    await handleCheckoutCompleted(session, deps);
    assert.equal(addRole.mock.calls.length, 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = addRole.mock.calls as any[];
    assert.equal(calls[0].arguments[0], 'disc-456');
  });

  test('referral bonus: concede 30 dias ao indicador na primeira compra', async () => {
    const referrerId = 'referrer-uuid';
    const db = createMockDb({
      dealspro_profiles: { discord_user_id: null, referred_by: 'REF123', is_admin: false, stripe_customer_id: null },
    });
    // Segunda query de referral — sobrescreve o resultado para o referrer
    const originalFrom = db.from.bind(db);
    let callCount = 0;
    db.from = (table: string) => {
      if (table === 'dealspro_profiles') {
        callCount++;
        if (callCount === 2) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { user_id: referrerId, plan: 'free', plan_expires_at: null, is_admin: false }, error: null }),
              }),
            }),
            update: (data: unknown) => { db.ops.push({ table, type: 'update', data, filters: { referral: true } }); return { eq: () => Promise.resolve({ error: null }) }; },
          } as never;
        }
      }
      return originalFrom(table);
    };

    const session = {
      client_reference_id: 'user-ref',
      mode:                'subscription',
      customer:            'cus_r',
      subscription:        'sub_r',
      metadata:            {},
    } as unknown as Stripe.Checkout.Session;
    const deps: StripeHandlerDeps = {
      db: db as never,
      addPremiumRole:       mock.fn(noop),
      removePremiumRole:    mock.fn(noop),
      retrieveSubscription: mock.fn(async () => ({ current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 })) as never,
    };

    await handleCheckoutCompleted(session, deps);
    const referralUpdate = db.ops.find((o) => o.filters['referral'] === true);
    assert.ok(referralUpdate, 'deve ter atualizado o perfil do indicador');
    assert.equal((referralUpdate!.data as Record<string, unknown>)['plan'], 'premium');
  });

  test('sem userId: retorna sem erros', async () => {
    const db      = createMockDb();
    const session = { client_reference_id: null, metadata: {}, mode: 'subscription' } as unknown as Stripe.Checkout.Session;
    await assert.doesNotReject(handleCheckoutCompleted(session, { db: db as never, addPremiumRole: noop, removePremiumRole: noop, retrieveSubscription: noop as never }));
    assert.equal(db.ops.length, 0);
  });
});

// ── customer.subscription.updated ────────────────────────────────────────────

describe('handleSubscriptionUpdated', () => {
  test('active → seta premium e adiciona role Discord', async () => {
    const db        = createMockDb({ dealspro_profiles: { discord_user_id: 'disc-u' } });
    const addRole   = mock.fn(noop);
    const removeRole = mock.fn(noop);
    const sub = {
      customer: 'cus_upd',
      status:   'active',
      current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(sub, { db: db as never, addPremiumRole: addRole, removePremiumRole: removeRole, retrieveSubscription: noop as never });

    const upd = db.ops.find((o) => o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['plan'], 'premium');
    assert.equal(addRole.mock.calls.length, 1);
    assert.equal(removeRole.mock.calls.length, 0);
  });

  test('canceled → seta free e remove role Discord', async () => {
    const db         = createMockDb({ dealspro_profiles: { discord_user_id: 'disc-u' } });
    const removeRole = mock.fn(noop);
    const sub = { customer: 'cus_can', status: 'canceled' } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(sub, { db: db as never, addPremiumRole: mock.fn(noop), removePremiumRole: removeRole, retrieveSubscription: noop as never });

    const upd = db.ops.find((o) => o.type === 'update');
    assert.equal((upd!.data as Record<string, unknown>)['plan'], 'free');
    assert.equal(removeRole.mock.calls.length, 1);
  });
});

// ── customer.subscription.deleted ────────────────────────────────────────────

describe('handleSubscriptionDeleted', () => {
  test('revoga premium, desativa alertas e remove role', async () => {
    const db         = createMockDb({ dealspro_profiles: { user_id: 'user-del', discord_user_id: 'disc-del' } });
    const removeRole = mock.fn(noop);
    const sub = { customer: 'cus_del', canceled_at: Math.floor(Date.now() / 1000) } as unknown as Stripe.Subscription;

    await handleSubscriptionDeleted(sub, { db: db as never, addPremiumRole: noop, removePremiumRole: removeRole, retrieveSubscription: noop as never });

    const profileUpd = db.ops.find((o) => o.table === 'dealspro_profiles');
    assert.equal((profileUpd!.data as Record<string, unknown>)['plan'], 'free');

    const alertUpd = db.ops.find((o) => o.table === 'user_alerts_dealspro');
    assert.equal((alertUpd!.data as Record<string, unknown>)['is_active'], false);

    assert.equal(removeRole.mock.calls.length, 1);
  });
});

// ── charge.refunded ───────────────────────────────────────────────────────────

describe('handleChargeRefunded', () => {
  test('reembolso parcial: ignora sem alterar plano', async () => {
    const db     = createMockDb();
    const charge = { id: 'ch_1', customer: 'cus_ref', amount: 1000, amount_refunded: 500 } as unknown as Stripe.Charge;

    await handleChargeRefunded(charge, { db: db as never, addPremiumRole: noop, removePremiumRole: noop, retrieveSubscription: noop as never });

    assert.equal(db.ops.length, 0, 'reembolso parcial não deve gerar nenhuma escrita');
  });

  test('reembolso total: revoga premium e desativa alertas', async () => {
    const db         = createMockDb({ dealspro_profiles: { user_id: 'user-rfd', discord_user_id: null } });
    const removeRole = mock.fn(noop);
    const charge     = { id: 'ch_2', customer: 'cus_rfd', amount: 1000, amount_refunded: 1000 } as unknown as Stripe.Charge;

    await handleChargeRefunded(charge, { db: db as never, addPremiumRole: noop, removePremiumRole: removeRole, retrieveSubscription: noop as never });

    const profileUpd = db.ops.find((o) => o.table === 'dealspro_profiles');
    assert.equal((profileUpd!.data as Record<string, unknown>)['plan'], 'free');

    const alertUpd = db.ops.find((o) => o.table === 'user_alerts_dealspro');
    assert.ok(alertUpd, 'deve desativar alertas');
  });

  test('sem customerId: retorna sem writes', async () => {
    const db     = createMockDb();
    const charge = { id: 'ch_3', customer: null, amount: 1000, amount_refunded: 1000 } as unknown as Stripe.Charge;

    await handleChargeRefunded(charge, { db: db as never, addPremiumRole: noop, removePremiumRole: noop, retrieveSubscription: noop as never });
    assert.equal(db.ops.length, 0);
  });
});
