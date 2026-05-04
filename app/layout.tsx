import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'DealsPro — Produtos CSS Deals em tempo real',
  description: 'Monitore e descubra os melhores produtos do CSS Deals antes de todo mundo.',
  other: {
    // Google AdSense site verification meta tag
    'google-adsense-account': 'ca-pub-5158893095104645',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dp-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`,
          }}
        />
        {/* Google AdSense — in <head> so the crawler finds it in the static HTML */}
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
