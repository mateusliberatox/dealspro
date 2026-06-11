/**
 * Tabela de tarifas de frete por agente de compras (CNY por pacote, destino:
 * Brasil) e helpers de cálculo — usada pela Calculadora de Frete pública
 * (`/frete`) e espelhada em `extension/popup/popup.js` (contexto isolado da
 * extensão, sem módulos compartilhados). Se atualizar uma tarifa aqui,
 * atualize também lá (e vice-versa).
 *
 * base:  taxa fixa de envio (CNY)
 * perKg: taxa por kg adicional acima do peso mínimo (CNY/kg)
 * minKg: peso mínimo cobrado
 *
 * Fonte: calculadoras públicas dos agentes (valores aproximados, atualizar
 * periodicamente).
 */

export interface FreightMethod {
  base:  number;
  perKg: number;
  minKg: number;
}

export interface FreightAgent {
  name: string;
  url: string;
  methods: Record<string, FreightMethod>;
}

export const FREIGHT_AGENTS: Record<string, FreightAgent> = {
  cssbuy: {
    name: 'CSBuy', url: 'https://www.cssbuy.com/estimates',
    methods: {
      'E-Packet BR':           { base: 28,  perKg: 22,  minKg: 0.1 },
      'Linha Brasil (CNE)':    { base: 35,  perKg: 22,  minKg: 0.1 },
      'YunExpress':            { base: 48,  perKg: 32,  minKg: 0.1 },
      'PostNL':                { base: 38,  perKg: 24,  minKg: 0.1 },
      'EMS':                   { base: 70,  perKg: 48,  minKg: 0.1 },
      'DHL Express':           { base: 120, perKg: 75,  minKg: 0.5 },
      'FedEx':                 { base: 135, perKg: 85,  minKg: 0.5 },
    },
  },
  pandabuy: {
    name: 'Pandabuy', url: 'https://www.pandabuy.com/freight-estimate',
    methods: {
      'Economy Line':          { base: 30,  perKg: 20,  minKg: 0.1 },
      'Linha Brasil':          { base: 38,  perKg: 24,  minKg: 0.1 },
      'YunExpress':            { base: 50,  perKg: 35,  minKg: 0.1 },
      'PostNL':                { base: 36,  perKg: 22,  minKg: 0.1 },
      'EMS':                   { base: 75,  perKg: 50,  minKg: 0.1 },
      'DHL Express':           { base: 130, perKg: 80,  minKg: 0.5 },
      'Frete Marítimo':        { base: 20,  perKg: 8,   minKg: 0.5 },
    },
  },
  sugargoo: {
    name: 'Sugargoo', url: 'https://www.sugargoo.com/#/home/freightEstimate',
    methods: {
      'E-Packet BR':           { base: 26,  perKg: 20,  minKg: 0.1 },
      'Linha Brasil':          { base: 36,  perKg: 22,  minKg: 0.1 },
      '4PX Standard':          { base: 45,  perKg: 30,  minKg: 0.1 },
      'PostNL':                { base: 32,  perKg: 19,  minKg: 0.1 },
      'EMS':                   { base: 68,  perKg: 46,  minKg: 0.1 },
      'DHL Express':           { base: 118, perKg: 72,  minKg: 0.5 },
    },
  },
  superbuy: {
    name: 'Superbuy', url: 'https://www.superbuy.com/en/page/freightestimate/',
    methods: {
      'Economy Line':          { base: 32,  perKg: 22,  minKg: 0.1 },
      'Linha Brasil Especial': { base: 40,  perKg: 25,  minKg: 0.1 },
      'YunExpress':            { base: 52,  perKg: 36,  minKg: 0.1 },
      'PostNL':                { base: 38,  perKg: 21,  minKg: 0.1 },
      'EMS':                   { base: 78,  perKg: 52,  minKg: 0.1 },
      'DHL Express':           { base: 125, perKg: 78,  minKg: 0.5 },
      'FedEx':                 { base: 140, perKg: 88,  minKg: 0.5 },
    },
  },
  wegobuy: {
    name: 'Wegobuy', url: 'https://www.wegobuy.com/en/page/freightestimate/',
    methods: {
      'Economy Line':          { base: 30,  perKg: 21,  minKg: 0.1 },
      'Linha Brasil Especial': { base: 36,  perKg: 22,  minKg: 0.1 },
      '4PX Standard':          { base: 48,  perKg: 33,  minKg: 0.1 },
      'PostNL':                { base: 34,  perKg: 20,  minKg: 0.1 },
      'EMS':                   { base: 72,  perKg: 48,  minKg: 0.1 },
      'DHL Express':           { base: 120, perKg: 74,  minKg: 0.5 },
    },
  },
  hagobuy: {
    name: 'Hagobuy', url: 'https://www.hagobuy.com/item/estimate_freight',
    methods: {
      'Economy Line':          { base: 28,  perKg: 20,  minKg: 0.1 },
      'Linha Brasil':          { base: 34,  perKg: 21,  minKg: 0.1 },
      'YunExpress':            { base: 46,  perKg: 30,  minKg: 0.1 },
      'PostNL':                { base: 35,  perKg: 20,  minKg: 0.1 },
      'EMS':                   { base: 68,  perKg: 46,  minKg: 0.1 },
      'DHL Express':           { base: 115, perKg: 72,  minKg: 0.5 },
    },
  },
  allchinabuy: {
    name: 'AllChinaBuy', url: 'https://www.allchinabuy.com/en/page/estimates/',
    methods: {
      'Economy (SAL)':         { base: 25,  perKg: 18,  minKg: 0.1 },
      'Linha Brasil':          { base: 33,  perKg: 20,  minKg: 0.1 },
      'YunExpress':            { base: 45,  perKg: 29,  minKg: 0.1 },
      'EMS':                   { base: 66,  perKg: 44,  minKg: 0.1 },
      'DHL Express':           { base: 112, perKg: 70,  minKg: 0.5 },
    },
  },
  // Um dos agentes mais usados pela comunidade BR atualmente (junto com
  // CSBuy/Pandabuy). Valores aproximados — Hoobuy não publica uma
  // calculadora pública detalhada por método como os demais agentes;
  // ajustar quando houver dados mais precisas.
  hoobuy: {
    name: 'Hoobuy', url: 'https://hoobuy.com/',
    methods: {
      'Linha Padrão':          { base: 27,  perKg: 19,  minKg: 0.1 },
      'Linha Brasil':          { base: 34,  perKg: 21,  minKg: 0.1 },
      'YunExpress':            { base: 46,  perKg: 30,  minKg: 0.1 },
      'EMS':                   { base: 70,  perKg: 47,  minKg: 0.1 },
      'DHL Express':           { base: 118, perKg: 73,  minKg: 0.5 },
    },
  },
};

export const CNY_BRL_FALLBACK = 0.82;

export interface FreightResult {
  cny: number | null;
  brl: number;
}

/**
 * Calcula o frete em CNY (quando aplicável) e BRL para um agente, método e
 * peso (em gramas) específicos.
 *
 * Para o método "Personalizado" (sem agente cadastrado, agentKey fora de
 * FREIGHT_AGENTS): usa `customPer100g` (R$ por 100g, proporcional ao peso)
 * se informado e > 0, senão `customBrl` (valor fixo), senão R$ 80 padrão.
 */
export function calcFreight(
  agentKey: string,
  methodName: string,
  weightGrams: number,
  rate: number,
  custom?: { customBrl?: number; customPer100g?: number },
): FreightResult {
  const agent = FREIGHT_AGENTS[agentKey];
  if (!agent) {
    if (custom?.customPer100g && custom.customPer100g > 0) {
      const brl = parseFloat(((weightGrams / 100) * custom.customPer100g).toFixed(2));
      return { cny: null, brl };
    }
    const brl = custom?.customBrl ?? 80;
    return { cny: null, brl };
  }

  const method = agent.methods[methodName];
  if (!method) return { cny: 80, brl: parseFloat((80 * rate).toFixed(2)) };

  const kg  = Math.max(method.minKg, weightGrams / 1000);
  const cny = method.base + method.perKg * (kg - method.minKg);
  return { cny: Math.round(cny), brl: parseFloat((cny * rate).toFixed(2)) };
}

/**
 * Busca a cotação CNY→BRL atual via open.er-api.com (mesma fonte usada pela
 * extensão e por lib/declaration.ts). Retorna o fallback fixo em caso de
 * falha — nunca lança.
 */
export async function getCnyToBrlRate(): Promise<number> {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/CNY', {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4_000),
    });
    const data = await res.json() as { rates?: Record<string, number> };
    return data.rates?.BRL ?? CNY_BRL_FALLBACK;
  } catch {
    return CNY_BRL_FALLBACK;
  }
}
