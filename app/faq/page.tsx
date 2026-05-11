import type { Metadata } from 'next';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'FAQ — Perguntas Frequentes',
  description: 'Tire suas dúvidas sobre o DealsPro — como funciona, diferença entre free e premium, alertas e Discord.',
};

const FAQS = [
  {
    q: 'O que é o DealsPro?',
    a: 'O DealsPro monitora o CSSDeals automaticamente a cada 2 minutos e exibe os produtos novos em um feed organizado, com filtros por categoria e tamanho. Membros Premium recebem acesso imediato e alertas por DM no Discord.',
  },
  {
    q: 'Qual a diferença entre o plano Free e o Premium?',
    a: 'No plano Free você acessa o feed com 30 minutos de atraso em relação ao momento em que o produto foi detectado. No Premium você vê o produto assim que é detectado, recebe notificações por DM no Discord e tem acesso ao canal exclusivo do servidor.',
  },
  {
    q: 'Como funcionam os alertas?',
    a: 'No plano Premium você cria alertas com palavra-chave, categoria e tamanho. Quando um produto novo corresponder ao seu alerta, você recebe uma DM automática do bot no Discord antes de qualquer usuário Free.',
  },
  {
    q: 'Preciso ter conta no Discord para usar?',
    a: 'Não é obrigatório para acessar o site. Mas para receber alertas por DM e acessar o canal Premium do servidor, você precisa vincular sua conta Discord em Minha Conta.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. O plano Premium é mensal e pode ser cancelado a qualquer momento pela página Minha Conta → Gerenciar Assinatura. Não há multa ou fidelidade.',
  },
  {
    q: 'O DealsPro vende os produtos?',
    a: 'Não. O DealsPro é um agregador — ao clicar em um produto você é redirecionado para o CSSDeals, onde a compra acontece. Não somos afiliados ao CSSDeals.',
  },
  {
    q: 'Como funciona o programa de indicação?',
    a: 'Em Minha Conta você encontra seu link de indicação único. Quando alguém criar uma conta pelo seu link e assinar o Premium, você ganha 1 mês grátis automaticamente.',
  },
  {
    q: 'Com que frequência novos produtos aparecem?',
    a: 'O scraper roda a cada 2 minutos. Em dias de mais movimento no CSSDeals podem aparecer dezenas de produtos novos por hora.',
  },
  {
    q: 'Posso assinar pelo Discord sem acessar o site?',
    a: 'Sim. Use o comando /assinar no nosso servidor Discord e o bot enviará um link exclusivo de pagamento só para você.',
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Perguntas frequentes
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Não encontrou sua dúvida? Entre em contato pelo Discord.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <details
              key={i}
              className="group rounded-xl border overflow-hidden animate-fade-in-up"
              style={{
                background:   'var(--surface)',
                borderColor:  'var(--border)',
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold list-none"
                style={{ color: 'var(--text)' }}
              >
                {q}
                <span
                  className="shrink-0 text-lg transition-transform duration-200 group-open:rotate-45"
                  style={{ color: 'var(--text-3)' }}
                >
                  +
                </span>
              </summary>
              <p
                className="px-5 pb-4 text-sm leading-relaxed"
                style={{ color: 'var(--text-2)' }}
              >
                {a}
              </p>
            </details>
          ))}
        </div>

      </main>
    </div>
  );
}
