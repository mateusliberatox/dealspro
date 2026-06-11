import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { FreightCalculator } from '@/components/freight-calculator';
import { getCnyToBrlRate } from '@/lib/freight';

export const revalidate = 3600; // câmbio atualizado a cada hora

export const metadata: Metadata = {
  title: 'Calculadora de Frete China → Brasil',
  description: 'Estime o frete e o custo total de importação (produto + frete + imposto) por agente de compras (CSBuy, Pandabuy, Hoobuy, AllChinaBuy e mais) e método de envio.',
};

export default async function FretePage() {
  const rate = await getCnyToBrlRate();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 space-y-6">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Calculadora de Frete China → Brasil
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: 'var(--text-3)' }}>
            Escolha o agente de compras (CSBuy, Pandabuy, Sugargoo, Superbuy, Wegobuy, Hagobuy,
            AllChinaBuy ou Hoobuy) e o método de envio para estimar o frete real, com base no peso do
            seu pacote. Some o valor do produto para ver o custo total estimado, incluindo o
            imposto de importação quando aplicável.
          </p>
        </div>

        <div className="animate-fade-in-up">
          <FreightCalculator rate={rate} />
        </div>

        <p className="text-xs" style={{ color: 'var(--text-4)' }}>
          ⚠️ Os valores são estimativas baseadas nas tarifas públicas divulgadas por cada agente e
          podem mudar sem aviso. O imposto de importação considera a regra geral de 60% sobre
          remessas acima de US$ 50 — casos individuais podem variar conforme a Receita Federal.
        </p>
      </main>
    </div>
  );
}
