import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse sua conta DealsPro e configure alertas de deals em tempo real.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
