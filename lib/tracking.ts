// 17Track API v2.2 — suporta +2000 transportadoras incluindo Correios (carrier 3011),
// China Post (2151), Cainiao (100003), SF Express (2905), etc.
// Correios BR* e outros códigos nacionais são detectados automaticamente.

const API_KEY  = process.env.SEVENTEEN_TRACK_API_KEY ?? '';
const API_BASE = 'https://api.17track.net/track/v2.2';

export type TrackingStatus =
  | 'pending' | 'in_transit' | 'customs'
  | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';

// Mapeamento de códigos de evento 17Track → status interno
const EVENT_TO_STATUS: Record<number, TrackingStatus> = {
  0:  'pending',
  10: 'pending',          // InfoReceived
  20: 'in_transit',       // InTransit
  25: 'in_transit',       // PickedUp
  30: 'failed',           // Undeliverable
  35: 'returned',         // ReturnedToSender
  40: 'delivered',        // Delivered
  50: 'failed',           // Exception
  60: 'customs',          // CustomsArrived (alguns carriers usam este código)
};

export const STATUS_LABELS: Record<TrackingStatus, string> = {
  pending:          'Aguardando postagem',
  in_transit:       'Em trânsito',
  customs:          'Na alfândega',
  out_for_delivery: 'Saiu para entrega',
  delivered:        'Entregue',
  failed:           'Problema na entrega',
  returned:         'Devolvido ao remetente',
};

export const STATUS_EMOJI: Record<TrackingStatus, string> = {
  pending:          '📋',
  in_transit:       '✈️',
  customs:          '🛃',
  out_for_delivery: '🚚',
  delivered:        '✅',
  failed:           '❌',
  returned:         '🔄',
};

export const STATUS_COLOR: Record<TrackingStatus, number> = {
  pending:          0x6b7280,
  in_transit:       0x3b82f6,
  customs:          0xf59e0b,
  out_for_delivery: 0x8b5cf6,
  delivered:        0x10b981,
  failed:           0xef4444,
  returned:         0xf97316,
};

export interface TrackingInfo {
  code:      string;
  carrier:   number;
  status:    TrackingStatus;
  lastEvent: string | null;
  lastAt:    string | null;
}

/** Registra códigos no 17Track para que o sistema comece a rastrear. */
export async function registerTrackings(codes: string[]): Promise<void> {
  if (!API_KEY || !codes.length) return;

  await fetch(`${API_BASE}/register`, {
    method:  'POST',
    headers: { '17token': API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify(codes.map((number) => ({ number, carrier: 0 }))),
    signal:  AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/**
 * Busca o status atualizado de até 40 encomendas de uma vez.
 * Inclui heurística para detectar alfândega via texto do evento.
 */
export async function getTrackingUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!API_KEY || !codes.length) return [];

  const res = await fetch(`${API_BASE}/gettrackinfo`, {
    method:  'POST',
    headers: { '17token': API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify(codes.map((number) => ({ number }))),
    signal:  AbortSignal.timeout(20_000),
  }).catch(() => null);

  if (!res?.ok) return [];

  const data     = await res.json().catch(() => null) as Record<string, unknown> | null;
  const accepted = (data?.data as Record<string, unknown>)?.accepted as unknown[] ?? [];

  return accepted.map((raw) => {
    const item  = raw as Record<string, unknown>;
    const track = item.track as Record<string, unknown> | null;
    const w1    = track?.w1 as Record<string, unknown> | null; // último status resumido

    const eventCode = (w1?.e as number) ?? 0;
    let status: TrackingStatus = EVENT_TO_STATUS[eventCode] ?? 'in_transit';

    // Heurística de alfândega: texto do evento menciona customs/alfândega/receita
    const eventText = ((w1?.z as string) || (w1?.v as string) || '').toLowerCase();
    if (
      status === 'in_transit' &&
      /customs|alfândega|receita federal|tributad|fisco|siscomex|importaç/i.test(eventText)
    ) {
      status = 'customs';
    }

    return {
      code:      item.number as string,
      carrier:   (item.carrier as number) ?? 0,
      status,
      lastEvent: (w1?.z as string) || (w1?.v as string) || null,
      lastAt:    (w1?.t as string) || null,
    };
  });
}

/** Verifica se a configuração da API está correta. */
export function trackingConfigured(): boolean {
  return !!API_KEY;
}
