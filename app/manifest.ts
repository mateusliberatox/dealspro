import type { MetadataRoute } from 'next';

// PWA manifest — torna o site instalável como app no mobile (Android/iOS) e desktop.
// Servido em /manifest.webmanifest automaticamente.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'DealsPro — Deals do CSSDeals',
    short_name:       'DealsPro',
    description:      'Monitoramento em tempo real de deals do CSSDeals com alertas via Discord e Telegram.',
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#0a0f1c',
    theme_color:      '#3b82f6',
    lang:             'pt-BR',
    categories:       ['shopping', 'lifestyle'],
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
