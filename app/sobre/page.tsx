import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Sobre o DealsPro',
  description: 'Conheça o DealsPro — o agregador de deals do CSSDeals com alertas em tempo real por Discord e Telegram.',
};

const FEATURES = [
  {
    icon: '⚡',
    title: 'Monitoramento em tempo real',
    desc: 'O bot rastreia o CSSDeals a cada 60 segundos e detecta produtos novos antes de qualquer pessoa.',
  },
  {
    icon: '🔔',
    title: 'Alertas por DM',
    desc: 'Configure palavras-chave, categorias e tamanhos. Receba uma mensagem direta no Discord ou Telegram quando um produto combinar.',
  },
  {
    icon: '📦',
    title: 'Rastreamento de encomendas',
    desc: 'Acompanhe suas compras do CSSDeals direto pelo Discord, com atualizações automáticas de status.',
  },
  {
    icon: '🤝',
    title: 'Comunidade',
    desc: 'Servidor no Discord com canais exclusivos para membros Premium: deals em primeira mão, dicas de importação e suporte da galera.',
  },
  {
    icon: '🛃',
    title: 'Simulador de declaração',
    desc: 'Use o comando /declarar no Discord para calcular o valor ideal de declaração para alfândega com base no produto e valor pago.',
  },
  {
    icon: '🆓',
    title: 'Plano gratuito',
    desc: 'Acesse o feed com 30 minutos de atraso sem pagar nada. Faça upgrade quando quiser receber em tempo real.',
  },
];

export default function SobrePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-10">

        {/* Hero */}
        <div className="flex flex-col items-center gap-4 text-center animate-fade-in-up">
          <Image src="/logo.png" alt="DealsPro" width={64} height={64} className="rounded-full" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Sobre o DealsPro
            </h1>
            <p className="mt-2 text-sm leading-relaxed max-w-md" style={{ color: 'var(--text-2)' }}>
              O DealsPro nasceu da frustração de perder os melhores deals do CSSDeals porque o site não avisa quando chegam produtos novos. Criamos um bot que faz isso por você.
            </p>
          </div>
        </div>

        {/* O que fazemos */}
        <section
          className="rounded-xl border p-5 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            O que fazemos
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            O DealsPro é um agregador e sistema de alertas para o CSSDeals — uma plataforma de compras internacionais focada em roupas, calçados e acessórios. Nosso bot monitora o site continuamente, organiza os produtos em um feed e notifica os membros em tempo real pelo Discord e Telegram.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Não somos uma loja e não temos vínculo comercial com o CSSDeals. Somos uma ferramenta independente criada por e para a comunidade de compradores.
          </p>
        </section>

        {/* Funcionalidades */}
        <section className="space-y-4 animate-fade-in-up">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            O que você encontra aqui
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border p-4 space-y-1"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-base">{icon} <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</span></p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Planos */}
        <section
          className="rounded-xl border p-5 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Planos
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            O DealsPro tem um plano <strong style={{ color: 'var(--text)' }}>Free</strong> — acesso ao feed com 30 minutos de atraso, sem cadastro de cartão — e um plano <strong style={{ color: 'var(--text)' }}>Premium</strong> mensal, com acesso em tempo real, alertas por DM, rastreamento de encomendas e canal exclusivo no Discord.
          </p>
          <Link
            href="/upgrade"
            className="inline-flex rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Ver planos →
          </Link>
        </section>

        {/* Contato */}
        <section
          className="rounded-xl border p-5 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Contato e suporte
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            O suporte é feito pelo servidor do Discord. Abra um ticket ou mande mensagem no canal de suporte — respondemos a todos.
          </p>
          <a
            href="https://discord.gg/dBXRdqM2Z"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--discord-color)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Entrar no Discord
          </a>
        </section>

        {/* Links institucionais */}
        <div className="flex flex-wrap gap-4 text-xs animate-fade-in-up" style={{ color: 'var(--text-3)' }}>
          <Link href="/politica-de-privacidade" className="hover:underline underline-offset-2">Política de Privacidade</Link>
          <Link href="/termos" className="hover:underline underline-offset-2">Termos de Uso</Link>
          <Link href="/faq" className="hover:underline underline-offset-2">FAQ</Link>
        </div>

      </main>
    </div>
  );
}
