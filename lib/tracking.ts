/**
 * Tracking de encomendas — suporta 4 providers com detecção automática:
 *
 * 1. WONCA      (WONCA_API_KEY)           — primário, gratuito (1000 req/mês c/ link no rodapé)
 *    Cadastro: https://wonca.com.br → Dashboard → Configurar API Keys
 *    API ref:  POST https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track
 *    Auth:     Authorization: Apikey YOUR_KEY
 *    Body:     {"code": "TRACKING_CODE"}
 *
 * 2. AfterShip  (AFTERSHIP_API_KEY)       — requer plano pago
 *    Cadastro: https://www.aftership.com → Settings → API Keys
 *
 * 3. 17Track    (SEVENTEEN_TRACK_API_KEY) — requer e-mail empresarial
 *    Cadastro: https://www.17track.net/en/api
 *
 * 4. Correios   (sem variável)            — fallback gratuito, sem cadastro, só códigos BR*
 *    Scraping do site público dos Correios, best-effort.
 *
 * O sistema detecta o provider automaticamente e expõe a mesma interface pública.
 */

// ── Tipos compartilhados ──────────────────────────────────────────────────────

export type TrackingStatus =
  | 'pending' | 'in_transit' | 'customs'
  | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';

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
  carrier:   number | string;
  status:    TrackingStatus;
  lastEvent: string | null;
  lastAt:    string | null;
  provider?: string;
}

export type Provider = 'wonca' | 'trackingmore' | 'aftership' | '17track' | 'correios';

function getProvider(): Provider {
  if (process.env.WONCA_API_KEY)           return 'wonca';
  if (process.env.TRACKINGMORE_API_KEY)    return 'trackingmore';
  if (process.env.AFTERSHIP_API_KEY)       return 'aftership';
  if (process.env.SEVENTEEN_TRACK_API_KEY) return '17track';
  return 'correios';
}

const CORREIOS_RE = /^[A-Z]{2}\d{9}BR$/i;

// ── Provider 1: WONCA (primário gratuito) ────────────────────────────────────
//
// API WONCA Labs — https://wonca.com.br
//
// Autenticação: header  Authorization: Apikey YOUR_KEY
// Endpoint:     POST https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track
// Body:         {"code": "TRACKING_CODE"}
//
// Resposta:
//   { "json": "<JSON-escaped string>", "carrier": "CARRIER_CORREIOS" }
//   O campo `json` é um JSON encodado como string, contendo:
//     codObjeto:  string
//     situacao:   string  ("T"=trânsito/retido, "E"=entregue, etc.)
//     eventos:    Array ordenado do mais recente → mais antigo
//       codigo:         string  (BDI, FC, PAR, PO, OEC, BDE…)
//       tipo:           string
//       dtHrCriado:     { date: "YYYY-MM-DD HH:mm:ss.000000", timezone: "America/Sao_Paulo" }
//       descricao:      string  (descrição em português)
//       descricaoFrontEnd: string
//       unidade:        { nome: string, endereco: { cidade?, uf? } }
//       finalizador:    "N"|"S"
//
// Limite gratuito: 1000 req/mês (com link no rodapé do site).

const WONCA_KEY  = () => process.env.WONCA_API_KEY ?? '';
const WONCA_URL  = 'https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track';

interface WoncaEvent {
  codigo:            string;
  tipo:              string;
  dtHrCriado:        { date: string; timezone?: string };
  descricao:         string;
  descricaoFrontEnd: string;
  unidade:           { nome?: string; endereco?: { cidade?: string; uf?: string } };
  finalizador:       string;
}

interface WoncaObject {
  codObjeto: string;
  situacao:  string;
  eventos:   WoncaEvent[];
}

function woncaParseStatus(descr: string): TrackingStatus {
  const d = descr.toLowerCase();
  if (/importa[çc][aã]o n[aã]o autorizada/.test(d))                       return 'failed';
  if (/entregue ao destinat|objeto entregue/.test(d))                      return 'delivered';
  if (/saiu para entrega|objeto em rota de entrega/.test(d))               return 'out_for_delivery';
  if (/devolvid|retornad/.test(d))                                         return 'returned';
  if (/retido|fiscaliz|autoridade aduaneira|tributad|receita federal|verifica[cç][aã]o de autenticidade|selecionado para/.test(d)) return 'customs';
  if (/an[aá]lise conclu[ií]da.*autorizada|informacoes eletronicas|informações eletrônicas|postado|objeto recebido|recebido pelos correios/.test(d)) return 'in_transit';
  if (/objeto recebido na unidade de distribuição|em processo de triagem/.test(d)) return 'in_transit';
  return 'in_transit';
}

async function woncaGetSingle(code: string): Promise<TrackingInfo | null> {
  const res = await fetch(WONCA_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Apikey ${WONCA_KEY()}`,
    },
    body:    JSON.stringify({ code }),
    signal:  AbortSignal.timeout(12_000),
  }).catch(() => null);

  if (!res?.ok) return correiosGetSingle(code); // fallback se WONCA falhar

  const outer = await res.json().catch(() => null) as { json?: string; code?: string } | null;

  // Créditos esgotados → fallback Correios direto (gratuito)
  if (!outer?.json || outer.code === 'failed_precondition') return correiosGetSingle(code);

  let obj: WoncaObject;
  try { obj = JSON.parse(outer.json) as WoncaObject; }
  catch { return null; }

  const eventos = obj.eventos ?? [];
  if (!eventos.length) {
    return { code, carrier: 'correios', status: 'pending', lastEvent: null, lastAt: null, provider: 'wonca' };
  }

  const ev      = eventos[0];
  const descr   = ev.descricao ?? '';
  const cidade  = ev.unidade?.endereco?.cidade ?? null;
  const uf      = ev.unidade?.endereco?.uf ?? null;
  const nome    = ev.unidade?.nome ?? null;
  const local   = nome || (cidade && uf ? `${cidade}, ${uf}` : cidade ?? uf ?? null);
  const lastEvent = local ? `${descr} — ${local}` : (descr || null);

  // Converte "YYYY-MM-DD HH:mm:ss.000000" → ISO
  const rawDate = ev.dtHrCriado?.date ?? null;
  const lastAt  = rawDate ? new Date(rawDate.replace(' ', 'T')).toISOString() : null;

  return {
    code,
    carrier:   'correios',
    status:    woncaParseStatus(descr),
    lastEvent,
    lastAt,
    provider:  'wonca',
  };
}

async function woncaGetUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!codes.length) return [];
  const results: TrackingInfo[] = [];
  // 5 paralelas por vez para não estourar rate limit
  for (let i = 0; i < codes.length; i += 5) {
    const batch   = codes.slice(i, i + 5);
    const settled = await Promise.allSettled(batch.map(woncaGetSingle));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }
  return results;
}

// ── Provider 2: TrackingMore ──────────────────────────────────────────────────
//
// API v4 — documentação: https://www.trackingmore.com/docs/trackingmore
//
// Autenticação: header  Tracking-Api-Key: YOUR_KEY
// Base URL:     https://api.trackingmore.com/v4
//
// Endpoints utilizados:
//   POST /couriers/detect                — detecta carrier de um código
//   POST /trackings/create              — registra código (erro 4016 se já existe)
//   POST /trackings/batch               — batch de até 40 por chamada
//   GET  /trackings/get?tracking_numbers=A,B,...  — busca status em batch
//
// Status tags (campo `tag` na resposta):
//   notfound   → pending      (código ainda não capturado pela transportadora)
//   pending    → pending      (informação recebida, aguardando movimentação)
//   transit    → in_transit   (em trânsito)
//   pickup     → out_for_delivery (saiu para entrega / disponível para retirada)
//   delivered  → delivered    (entregue)
//   undelivered→ failed       (tentativa falhou)
//   exception  → failed       (exceção/problema)
//   expired    → failed       (prazo expirado)
//
// Courier codes relevantes:
//   correios   → Correios (Brasil)
//   china-post → China Post / EMS
//   cainiao    → Cainiao (AliExpress logistics)
//   yanwen     → Yanwen Express
//   4px        → 4PX Express
//   (deixar vazio = auto-detect pelo TrackingMore)

const TM_KEY  = () => process.env.TRACKINGMORE_API_KEY ?? '';
const TM_BASE = 'https://api.trackingmore.com/v4';

const TM_TAG_MAP: Record<string, TrackingStatus> = {
  notfound:    'pending',
  pending:     'pending',
  transit:     'in_transit',
  pickup:      'out_for_delivery',
  delivered:   'delivered',
  undelivered: 'failed',
  exception:   'failed',
  expired:     'failed',
};

/** Detecta o courier_code a partir do número de rastreamento. */
async function tmDetectCourier(trackingNumber: string): Promise<string> {
  // Correios BR* → sempre correios, sem precisar chamar a API
  if (CORREIOS_RE.test(trackingNumber)) return 'correios';

  const res = await fetch(`${TM_BASE}/couriers/detect`, {
    method:  'POST',
    headers: { 'Tracking-Api-Key': TM_KEY(), 'Content-Type': 'application/json' },
    body:    JSON.stringify({ tracking_number: trackingNumber }),
    signal:  AbortSignal.timeout(8_000),
  }).catch(() => null);

  if (!res?.ok) return '';

  const body     = await res.json().catch(() => null) as Record<string, unknown> | null;
  const couriers = (body?.data as unknown[]) ?? [];
  // Pega o primeiro carrier detectado
  const first    = (couriers[0] as Record<string, unknown> | undefined);
  return (first?.courier_code as string) ?? '';
}

async function tmRegister(codes: string[]): Promise<void> {
  if (!codes.length) return;

  // Batch de até 40 por chamada
  for (let i = 0; i < codes.length; i += 40) {
    const batch = codes.slice(i, i + 40);

    // Detecta couriers em paralelo (BR* é resolvido localmente, sem API call)
    const couriers = await Promise.all(batch.map(tmDetectCourier));

    const payload = batch.map((tracking_number, j) => ({
      tracking_number,
      courier_code: couriers[j] || '',
    }));

    await fetch(`${TM_BASE}/trackings/batch`, {
      method:  'POST',
      headers: { 'Tracking-Api-Key': TM_KEY(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(15_000),
    }).catch(() => {});
  }
}

async function tmGetUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!codes.length) return [];

  const results: TrackingInfo[] = [];

  // GET aceita até 40 códigos por chamada
  for (let i = 0; i < codes.length; i += 40) {
    const batch  = codes.slice(i, i + 40);
    const params = new URLSearchParams({ tracking_numbers: batch.join(',') });

    const res = await fetch(`${TM_BASE}/trackings/get?${params}`, {
      headers: { 'Tracking-Api-Key': TM_KEY() },
      signal:  AbortSignal.timeout(20_000),
    }).catch(() => null);

    if (!res?.ok) continue;

    const body  = await res.json().catch(() => null) as Record<string, unknown> | null;
    const items = ((body?.data as Record<string, unknown>)?.items as unknown[]) ?? [];

    for (const raw of items as Array<Record<string, unknown>>) {
      const tag   = (raw.tag as string | null) ?? 'pending';
      let status  = TM_TAG_MAP[tag] ?? 'in_transit';

      // Último evento e localização
      const latestEvent    = (raw.latest_event as string)           ?? '';
      const latestCheckpoint = (raw.latest_checkpoint_time as string) ?? null;

      // Heurística de alfândega via texto do evento
      if (status === 'in_transit' && /customs|alfândega|receita federal|tributad|fisco|retenid/i.test(latestEvent)) {
        status = 'customs';
      }

      results.push({
        code:      raw.tracking_number as string,
        carrier:   (raw.courier_code as string) ?? '',
        status,
        lastEvent: latestEvent || null,
        lastAt:    latestCheckpoint,
        provider:  'trackingmore',
      });
    }
  }

  return results;
}

// ── Provider 3: AfterShip ─────────────────────────────────────────────────────
//
// API v2023-10 — documentação: https://www.aftership.com/docs/tracking
//
// Autenticação: header  as-api-key: YOUR_KEY
// Base URL:     https://api.aftership.com/tracking/2023-10
//
// Endpoints utilizados:
//   POST /trackings              — registra código (200 ou 4007 se já existe)
//   GET  /trackings?tracking_numbers=A,B,...&fields=...
//                                — busca status em batch (até 100 por request)
//
// Campos relevantes da resposta de GET /trackings:
//   data.trackings[].tracking_number  — código
//   data.trackings[].slug             — carrier (ex: "correios", "china-post")
//   data.trackings[].tag              — status (Pending|InTransit|Delivered|...)
//   data.trackings[].last_checkpoint.message          — descrição do evento
//   data.trackings[].last_checkpoint.location         — local do evento
//   data.trackings[].last_checkpoint.checkpoint_time  — ISO timestamp

const AS_KEY  = () => process.env.AFTERSHIP_API_KEY ?? '';
const AS_BASE = 'https://api.aftership.com/tracking/2023-10';

const AS_TAG_MAP: Record<string, TrackingStatus> = {
  Pending:            'pending',
  InfoReceived:       'pending',
  InTransit:          'in_transit',
  OutForDelivery:     'out_for_delivery',
  AttemptFail:        'failed',
  Delivered:          'delivered',
  AvailableForPickup: 'out_for_delivery',
  Exception:          'failed',
  Expired:            'failed',
};

async function asRegister(codes: string[]): Promise<void> {
  // Registra cada código individualmente — AfterShip não aceita batch no POST.
  // Erro 4007 (já existe) é silenciado.
  await Promise.allSettled(
    codes.map((tracking_number) =>
      fetch(`${AS_BASE}/trackings`, {
        method:  'POST',
        headers: {
          'as-api-key':    AS_KEY(),
          'Content-Type':  'application/json',
        },
        body:   JSON.stringify({ tracking: { tracking_number } }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {}),
    ),
  );
}

async function asGetUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!codes.length) return [];

  // GET /trackings?tracking_numbers=A,B,C&fields=tracking_number,slug,tag,last_checkpoint
  const params = new URLSearchParams({
    tracking_numbers: codes.join(','),
    fields: 'tracking_number,slug,tag,last_checkpoint',
    limit:  String(Math.min(codes.length, 100)),
  });

  const res = await fetch(`${AS_BASE}/trackings?${params}`, {
    headers: { 'as-api-key': AS_KEY() },
    signal:  AbortSignal.timeout(20_000),
  }).catch(() => null);

  if (!res?.ok) return [];

  const body      = await res.json().catch(() => null) as Record<string, unknown> | null;
  const trackings = ((body?.data as Record<string, unknown>)?.trackings as unknown[]) ?? [];

  return (trackings as Array<Record<string, unknown>>).map((t) => {
    const tag        = (t.tag as string | null) ?? 'Pending';
    let   status     = AS_TAG_MAP[tag] ?? 'in_transit';
    const checkpoint = t.last_checkpoint as Record<string, unknown> | null;
    const message    = (checkpoint?.message  as string) ?? '';
    const location   = (checkpoint?.location as string) ?? '';
    const eventText  = `${message} ${location}`.toLowerCase();

    // Heurística de alfândega
    if (status === 'in_transit' && /customs|alfândega|receita federal|tributad|fisco|retenid/i.test(eventText)) {
      status = 'customs';
    }

    return {
      code:      t.tracking_number as string,
      carrier:   (t.slug as string) ?? '',
      status,
      lastEvent: message || location || null,
      lastAt:    (checkpoint?.checkpoint_time as string) ?? null,
      provider:  'aftership',
    };
  });
}

// ── Provider 4: 17Track (secundário) ─────────────────────────────────────────

const T17_KEY  = () => process.env.SEVENTEEN_TRACK_API_KEY ?? '';
const T17_BASE = 'https://api.17track.net/track/v2.2';

const T17_EVENT: Record<number, TrackingStatus> = {
  0: 'pending', 10: 'pending', 20: 'in_transit', 25: 'in_transit',
  30: 'failed', 35: 'returned', 40: 'delivered', 50: 'failed', 60: 'customs',
};

async function t17Register(codes: string[]): Promise<void> {
  await fetch(`${T17_BASE}/register`, {
    method:  'POST',
    headers: { '17token': T17_KEY(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(codes.map((number) => ({ number, carrier: 0 }))),
    signal:  AbortSignal.timeout(10_000),
  }).catch(() => {});
}

async function t17GetUpdates(codes: string[]): Promise<TrackingInfo[]> {
  const res = await fetch(`${T17_BASE}/gettrackinfo`, {
    method:  'POST',
    headers: { '17token': T17_KEY(), 'Content-Type': 'application/json' },
    body:    JSON.stringify(codes.map((number) => ({ number }))),
    signal:  AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return [];

  const body     = await res.json().catch(() => null) as Record<string, unknown> | null;
  const accepted = (((body?.data as Record<string, unknown>)?.accepted) as unknown[]) ?? [];

  return (accepted as Array<Record<string, unknown>>).map((item) => {
    const w1        = ((item.track as Record<string, unknown>)?.w1) as Record<string, unknown> | null;
    const eventCode = (w1?.e as number) ?? 0;
    let   status    = T17_EVENT[eventCode] ?? 'in_transit';
    const eventText = `${w1?.z ?? ''} ${w1?.v ?? ''}`.toLowerCase();
    if (status === 'in_transit' && /customs|alfândega|receita|tributad|fisco/i.test(eventText)) {
      status = 'customs';
    }
    return {
      code:      item.number as string,
      carrier:   (item.carrier as number) ?? 0,
      status,
      lastEvent: (w1?.z as string) || (w1?.v as string) || null,
      lastAt:    (w1?.t as string) || null,
      provider:  '17track',
    };
  });
}

// ── Provider 5: Correios direto (fallback gratuito) ───────────────────────────
//
// Consulta o site público dos Correios e extrai os dados do __NEXT_DATA__ SSR.
// Fallback: regex no HTML se o JSON não estiver disponível.
// Funciona APENAS para códigos com padrão XY123456789BR.

async function correiosGetSingle(code: string): Promise<TrackingInfo | null> {
  const res = await fetch(
    `https://rastreamento.correios.com.br/app/resultado.php?objeto=${code}`,
    {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control':   'no-cache',
      },
      signal: AbortSignal.timeout(12_000),
    },
  ).catch(() => null);

  if (!res?.ok) return null;
  const html = await res.text().catch(() => '');

  // 1. Tenta extrair do __NEXT_DATA__ (SSR Next.js) — mais confiável
  const ndMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (ndMatch) {
    try {
      const nd     = JSON.parse(ndMatch[1]) as Record<string, unknown>;
      const pp     = ((nd.props as Record<string, unknown>)?.pageProps) as Record<string, unknown>;
      const obj    = (pp?.objeto ?? (pp?.objetos as unknown[])?.[0]) as Record<string, unknown> | null;
      const eventos: unknown[] = (obj?.eventos as unknown[]) ?? [];

      if (eventos.length > 0) {
        const ev    = eventos[0] as Record<string, unknown>;
        const descr = String(ev?.descricao ?? '');
        const dtHr  = (ev?.dtHrCriado as string) ?? null;
        const unid  = ev?.unidade as Record<string, unknown> | null;
        const end   = unid?.endereco as Record<string, unknown> | null;
        const local = unid
          ? [unid.nome, end?.cidade, end?.uf].filter(Boolean).join(', ')
          : null;

        return {
          code,
          carrier:   3011,
          status:    correiosParseStatus(descr),
          lastEvent: local ? `${descr} — ${local}` : descr,
          lastAt:    dtHr,
          provider:  'correios',
        };
      }
    } catch { /* continua para fallback HTML */ }
  }

  // 2. Fallback: regex no HTML
  const descMatch = html.match(/descricao[^>]*>\s*([^<]{4,})</i)
    ?? html.match(/Situação\s*:?\s*<[^>]+>([^<]{4,})/i);
  const descr = descMatch?.[1]?.trim();

  return {
    code,
    carrier:   3011,
    status:    descr ? correiosParseStatus(descr) : 'pending',
    lastEvent: descr ?? null,
    lastAt:    null,
    provider:  'correios',
  };
}

function correiosParseStatus(descr: string): TrackingStatus {
  const d = descr.toLowerCase();
  if (/entregue ao destinat|objeto entregue/.test(d)) return 'delivered';
  if (/saiu para entrega/.test(d))                    return 'out_for_delivery';
  if (/devolvid|retornad ao remetente/.test(d))       return 'returned';
  if (/fiscaliz|receita federal|aguarda retirada|tributad/.test(d)) return 'customs';
  if (/postado|objeto recebido|coletado/.test(d))     return 'pending';
  return 'in_transit';
}

async function correiosGetUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!codes.length) return [];
  // Aceita qualquer código — Correios rastreia BR* e internacionais (LZ, RX, CN, etc.)
  const results = await Promise.allSettled(codes.map(correiosGetSingle));
  return results.flatMap((r) => r.status === 'fulfilled' && r.value ? [r.value] : []);
}

// ── Interface pública ─────────────────────────────────────────────────────────

/**
 * Registra códigos no provider ativo.
 * AfterShip e 17Track precisam de registro prévio; Correios não.
 */
export async function registerTrackings(codes: string[]): Promise<void> {
  if (!codes.length) return;
  const p = getProvider();
  if (p === 'trackingmore') return tmRegister(codes);
  if (p === 'aftership')    return asRegister(codes);
  if (p === '17track')      return t17Register(codes);
  // wonca & correios: sem registro necessário (query on-demand)
}

/**
 * Retorna status atualizado para os códigos informados.
 * WONCA/Correios: chamadas individuais paralelas (5 por vez).
 * TrackingMore/AfterShip/17Track: batch nativo da API.
 */
export async function getTrackingUpdates(codes: string[]): Promise<TrackingInfo[]> {
  if (!codes.length) return [];
  const p = getProvider();
  if (p === 'wonca')        return woncaGetUpdates(codes);
  if (p === 'trackingmore') return tmGetUpdates(codes);
  if (p === 'aftership')    return asGetUpdates(codes);
  if (p === '17track')      return t17GetUpdates(codes);
  return correiosGetUpdates(codes);
}

export function getActiveProvider(): Provider { return getProvider(); }
export function trackingConfigured(): boolean  { return true; }
export function hasApiTracking(): boolean      { return getProvider() !== 'correios'; }
