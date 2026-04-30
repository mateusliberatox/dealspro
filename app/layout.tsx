import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DealsPro — Produtos CSS Deals em tempo real',
  description: 'Monitore e descubra os melhores produtos do CSS Deals antes de todo mundo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
