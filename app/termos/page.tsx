import type { Metadata } from 'next';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos de uso do DealsPro — regras, planos, cancelamento e responsabilidades.',
};

const LAST_UPDATED = '05 de junho de 2026';

const SECTIONS = [
  {
    title: '1. Aceitação dos termos',
    content: `Ao criar uma conta ou usar o DealsPro, você concorda com estes Termos de Uso. Se não concordar com algum ponto, não utilize o serviço.`,
  },
  {
    title: '2. O que é o DealsPro',
    content: `O DealsPro é um serviço de monitoramento e agregação de produtos do site CSSDeals. Não somos uma loja, não vendemos produtos e não temos vínculo comercial com o CSSDeals ou qualquer vendedor listado nele. Atuamos apenas como intermediário de informação.`,
  },
  {
    title: '3. Cadastro e conta',
    content: `Para usar os recursos completos do DealsPro, você deve criar uma conta com e-mail válido ou autenticação via Discord. Você é responsável por manter a segurança das suas credenciais de acesso e por todas as ações realizadas na sua conta.`,
  },
  {
    title: '4. Planos e pagamento',
    content: `O DealsPro oferece dois planos:

• Plano Free: acesso ao feed com 30 minutos de atraso, sem alertas por DM.
• Plano Premium: acesso imediato ao feed, alertas por DM no Discord e Telegram, canal exclusivo no servidor Discord.

O plano Premium é cobrado mensalmente. O valor vigente está exibido na página de upgrade. O pagamento é processado por Stripe (cartão) ou MercadoPago (PIX).`,
  },
  {
    title: '5. Cancelamento e reembolso',
    content: `Você pode cancelar o plano Premium a qualquer momento em Minha Conta → Gerenciar Assinatura, sem multa. O acesso Premium permanece ativo até o final do período já pago.

Reembolsos são avaliados caso a caso. Em caso de cobrança indevida ou falha técnica comprovada do nosso lado, entre em contato pelo Discord.`,
  },
  {
    title: '6. Programa de indicação',
    content: `Ao indicar um amigo que assine o plano Premium, você recebe 1 mês de Premium gratuitamente. O benefício é creditado automaticamente após a confirmação do pagamento do indicado. Não é permitido criar contas falsas ou usar meios fraudulentos para obter benefícios do programa.`,
  },
  {
    title: '7. Uso aceitável',
    content: `Ao usar o DealsPro, você concorda em não:

• Tentar acessar dados de outros usuários
• Fazer engenharia reversa, scraping ou reprodução do serviço
• Usar o serviço para fins ilegais ou fraudulentos
• Compartilhar credenciais de conta Premium com terceiros
• Sobrecarregar intencionalmente a infraestrutura do serviço`,
  },
  {
    title: '8. Disponibilidade do serviço',
    content: `Nos esforçamos para manter o DealsPro disponível continuamente, mas não garantimos disponibilidade ininterrupta. Manutenções, atualizações e problemas técnicos podem causar interrupções temporárias. Não seremos responsáveis por perdas decorrentes de indisponibilidade do serviço.`,
  },
  {
    title: '9. Isenção de responsabilidade',
    content: `O DealsPro exibe informações coletadas automaticamente do CSSDeals. Não garantimos a precisão, completude ou atualidade dos preços e disponibilidade dos produtos. A decisão de compra é de inteira responsabilidade do usuário.

Não nos responsabilizamos por problemas ocorridos em compras realizadas no CSSDeals ou em qualquer outra plataforma para a qual redirecionamos o usuário.`,
  },
  {
    title: '10. Propriedade intelectual',
    content: `O código, design, marca e conteúdo original do DealsPro são de nossa propriedade. Os dados de produtos exibidos são de terceiros e pertencem aos seus respectivos titulares. É vedada a reprodução, distribuição ou uso comercial do nosso conteúdo sem autorização expressa.`,
  },
  {
    title: '11. Alterações nos termos',
    content: `Podemos atualizar estes Termos de Uso periodicamente. Publicaremos a nova versão com a data de atualização. O uso continuado do serviço após as alterações constitui aceite dos novos termos.`,
  },
  {
    title: '12. Lei aplicável',
    content: `Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de domicílio do usuário para resolução de quaisquer conflitos, salvo disposição legal em contrário.`,
  },
  {
    title: '13. Contato',
    content: `Para dúvidas sobre estes termos, entre em contato pelo servidor do Discord em discord.gg/dBXRdqM2Z.`,
  },
];

export default function TermosPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Termos de Uso
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Última atualização: {LAST_UPDATED}
          </p>
        </div>

        <div className="space-y-6">
          {SECTIONS.map(({ title, content }, i) => (
            <section
              key={i}
              className="rounded-xl border p-5 space-y-2 animate-fade-in-up"
              style={{
                background:     'var(--surface)',
                borderColor:    'var(--border)',
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {title}
              </h2>
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--text-2)' }}
              >
                {content}
              </p>
            </section>
          ))}
        </div>

      </main>
    </div>
  );
}
