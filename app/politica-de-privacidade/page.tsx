import type { Metadata } from 'next';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de privacidade do DealsPro — como coletamos, usamos e protegemos seus dados.',
};

const LAST_UPDATED = '05 de junho de 2026';

const SECTIONS = [
  {
    title: '1. Quem somos',
    content: `O DealsPro é um serviço de monitoramento de produtos do CSSDeals, operado de forma independente e sem vínculo com o CSSDeals ou qualquer loja parceira. Nosso site está disponível em dealspro-chi.vercel.app e em domínios associados.`,
  },
  {
    title: '2. Dados que coletamos',
    content: `Ao criar uma conta ou usar o serviço, podemos coletar:

• E-mail e dados de autenticação (via Supabase Auth ou OAuth com Discord)
• Nome de usuário e avatar do Discord (quando você conecta sua conta)
• Username do Telegram (quando você conecta via bot)
• Histórico de produtos acessados (para estatísticas de uso)
• Alertas e preferências configurados por você
• Dados de pagamento (processados diretamente pelo Stripe ou MercadoPago — não armazenamos dados de cartão)
• Endereço IP e informações do navegador (coletados automaticamente por logs do servidor)`,
  },
  {
    title: '3. Como usamos seus dados',
    content: `Utilizamos suas informações para:

• Autenticar sua conta e manter sua sessão ativa
• Enviar notificações de alertas por DM no Discord ou Telegram
• Processar pagamentos e controlar o acesso ao plano Premium
• Melhorar o serviço com base no uso agregado e anônimo
• Cumprir obrigações legais quando aplicável`,
  },
  {
    title: '4. Cookies e tecnologias similares',
    content: `Utilizamos cookies essenciais para manter sua sessão autenticada. Também utilizamos serviços de terceiros que podem definir cookies próprios:

• Google AdSense — exibe anúncios contextuais e pode coletar dados de navegação para personalização. Você pode gerenciar preferências em adssettings.google.com.
• Supabase — armazenamento de dados e autenticação.
• Vercel — hospedagem e logs de acesso.

Você pode desabilitar cookies no seu navegador, mas algumas funcionalidades do site podem deixar de funcionar.`,
  },
  {
    title: '5. Compartilhamento de dados',
    content: `Não vendemos seus dados pessoais. Compartilhamos informações apenas com:

• Supabase (banco de dados e autenticação)
• Stripe e MercadoPago (processamento de pagamentos)
• Discord (envio de notificações via bot)
• Telegram (envio de notificações via bot)
• Google (AdSense — publicidade)
• Vercel (hospedagem — logs de acesso)

Todos os parceiros possuem suas próprias políticas de privacidade e são responsáveis pelo tratamento dos dados em suas plataformas.`,
  },
  {
    title: '6. Retenção de dados',
    content: `Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta, removemos seus dados pessoais em até 30 dias, exceto onde a retenção for exigida por lei (ex.: registros de pagamento).`,
  },
  {
    title: '7. Seus direitos',
    content: `De acordo com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018), você tem direito a:

• Confirmar a existência de tratamento dos seus dados
• Acessar, corrigir ou atualizar seus dados
• Solicitar a exclusão dos seus dados
• Revogar consentimentos previamente concedidos
• Solicitar a portabilidade dos dados

Para exercer esses direitos, entre em contato pelo servidor do Discord ou pelo e-mail de suporte informado lá.`,
  },
  {
    title: '8. Segurança',
    content: `Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia em trânsito (HTTPS), autenticação segura via Supabase Auth e controle de acesso por função. Nenhum sistema é 100% seguro — em caso de incidente de segurança, notificaremos os usuários afetados conforme exigido pela LGPD.`,
  },
  {
    title: '9. Menores de idade',
    content: `O DealsPro não é direcionado a menores de 13 anos e não coleta intencionalmente dados de crianças. Se você identificar que uma criança criou uma conta, entre em contato para que possamos remover os dados.`,
  },
  {
    title: '10. Alterações nesta política',
    content: `Podemos atualizar esta Política de Privacidade periodicamente. Quando houver mudanças relevantes, publicaremos a nova versão com a data de atualização no topo desta página. O uso continuado do serviço após a publicação constitui aceite das alterações.`,
  },
  {
    title: '11. Contato',
    content: `Para dúvidas, solicitações ou reclamações sobre privacidade, entre em contato pelo servidor do Discord em discord.gg/dBXRdqM2Z. Responderemos em até 5 dias úteis.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Política de Privacidade
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
                background:       'var(--surface)',
                borderColor:      'var(--border)',
                animationDelay:   `${i * 0.04}s`,
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
