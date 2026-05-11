import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const SITE_URL = 'https://dealspro-chi.vercel.app';

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
  other: {
    'google-adsense-account': 'ca-pub-5158893095104645',
  },
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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5158893095104645"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
