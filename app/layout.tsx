import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import { CookieBanner } from '@/components/cookie-banner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:  'DealsPro — Deals do CSSDeals em tempo real',
    template: '%s | DealsPro',
  },
  description: 'Monitore os melhores achados do CSSDeals antes de esgotar. Alertas por Discord, filtros por tamanho e acesso premium em tempo real.',
  keywords: ['cssdeals', 'deals', 'roupas importadas', 'desconto', 'promoção', 'alerta de preço'],
  authors: [{ name: 'DealsPro' }],
  openGraph: {
    type:        'website',
    locale:      'pt_BR',
    url:          SITE_URL,
    siteName:    'DealsPro',
    title:       'DealsPro — Deals do CSSDeals em tempo real',
    description: 'Monitore os melhores achados do CSSDeals antes de esgotar. Alertas por Discord, filtros por tamanho e acesso premium em tempo real.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'DealsPro' }],
  },
  twitter: {
    card:        'summary',
    title:       'DealsPro — Deals do CSSDeals em tempo real',
    description: 'Alertas de deals em tempo real. Nunca mais perca um achado.',
    images:      ['/logo.png'],
  },
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png', sizes: '512x512' }],
    apple: '/logo.png',
  },
  appleWebApp: {
    capable:     true,
    title:       'DealsPro',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'google-adsense-account': 'ca-pub-5158893095104645',
  },
};

export const viewport = {
  themeColor:     '#0a0f1c',
  colorScheme:    'dark light',
  width:          'device-width',
  initialScale:   1,
};

const ORGANIZATION_SCHEMA = {
  '@context':   'https://schema.org',
  '@type':      'Organization',
  name:         'DealsPro',
  url:          SITE_URL,
  logo:         `${SITE_URL}/logo.png`,
  description:  'Monitoramento em tempo real de deals do CSSDeals com alertas via Discord e Telegram.',
  sameAs:       ['https://discord.gg/dBXRdqM2Z'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dp-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <CookieBanner />
        <footer className="border-t border-white/5 py-6 text-center text-xs text-white/30">
          <div className="mx-auto max-w-4xl px-4 flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              <a href="/ranking" className="hover:text-white/60 transition-colors">Ranking</a>
              <a href="/categoria/roupas" className="hover:text-white/60 transition-colors">Roupas</a>
              <a href="/categoria/calcados" className="hover:text-white/60 transition-colors">Calçados</a>
              <a href="/categoria/bolsas" className="hover:text-white/60 transition-colors">Bolsas</a>
              <a href="/categoria/acessorios" className="hover:text-white/60 transition-colors">Acessórios</a>
              <a href="/categoria/eletronicos" className="hover:text-white/60 transition-colors">Eletrônicos</a>
              <a href="/faq" className="hover:text-white/60 transition-colors">FAQ</a>
              <a href="/sobre" className="hover:text-white/60 transition-colors">Sobre</a>
              <a href="/politica-de-privacidade" className="hover:text-white/60 transition-colors">Privacidade</a>
              <a href="/termos" className="hover:text-white/60 transition-colors">Termos</a>
              <a href="https://www.siterastreio.com.br/" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">Rastreamento</a>
              <a href="https://discord.gg/dBXRdqM2Z" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">Discord</a>
            </div>
            <p className="text-white/20">© {new Date().getFullYear()} DealsPro · Não somos afiliados ao CSSDeals</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
