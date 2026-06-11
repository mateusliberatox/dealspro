'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

// Ícones SVG inline
function IconRanking() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IconDiscord() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconMoon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>;
}
function IconSun() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zm9-9h-2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2zM5 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zm11.95-6.95a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zM7.05 16.95a1 1 0 0 1 0 1.414L5.636 19.778a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zm9.9 0a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414zM7.05 7.05a1 1 0 0 1-1.414 0L4.222 5.636A1 1 0 0 1 5.636 4.222L7.05 5.636a1 1 0 0 1 0 1.414z"/></svg>;
}

export function Header() {
  const [user, setUser]           = useState<User | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme]         = useState<'dark' | 'light'>('dark');
  const [navOpen, setNavOpen]     = useState(false);
  const pathname                  = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('dp-theme');
    if (saved === 'light') setTheme('light');
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setNavOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase
          .from('dealspro_profiles')
          .select('is_admin, plan')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: p }) => {
            setIsAdmin(!!p?.is_admin);
            setIsPremium(p?.plan === 'premium');
            setAuthReady(true);
          });
      } else {
        setAuthReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) { setIsAdmin(false); setIsPremium(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setNavOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dp-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  };

  const closeNav = () => setNavOpen(false);

  return (
    <>
      <header
        className="sticky top-0 z-50 animate-fade-in-down"
        style={{
          background:           'var(--header-bg)',
          backdropFilter:       'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom:         '1px solid rgba(59, 130, 246, 0.18)',
        }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">

          {/* Esquerda: logo + botão de menu */}
          <div className="flex items-center gap-3">
            {/* Botão de menu */}
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--text-2)' }}
              aria-label="Abrir menu de navegação"
              aria-expanded={navOpen}
            >
              <IconMenu />
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="DealsPro" width={32} height={32} priority className="h-8 w-8 rounded-full" />
              <span className="text-[1.05rem] font-black uppercase tracking-[0.03em] leading-none">
                <span style={{ color: 'var(--text)' }}>DEALS</span>
                <span className="gradient-blue-text">PRO</span>
              </span>
            </Link>
          </div>

          {/* Direita: tema + perfil + sair */}
          <div className="flex items-center gap-1.5">

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="rounded-lg p-2 transition-colors"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {theme === 'dark' ? <IconMoon /> : <IconSun />}
            </button>

            {authReady && user && (
              <>
                {/* Perfil */}
                <Link
                  href="/minha-conta"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    border:     '1px solid var(--border)',
                    color:      'var(--text-2)',
                  }}
                >
                  {isPremium && <span style={{ color: 'var(--accent-text)' }}>★</span>}
                  <span>{user.email?.split('@')[0]}</span>
                </Link>

                {/* Sair */}
                <button
                  onClick={signOut}
                  className="rounded-lg px-3 py-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                >
                  Sair
                </button>
              </>
            )}

            {authReady && !user && (
              <Link
                href="/login"
                className="gradient-blue-bright ripple shine-effect rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar de navegação */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={closeNav}
        />
      )}

      <aside
        className="fixed left-0 top-0 z-50 flex h-full w-64 max-w-[80vw] flex-col transition-transform duration-300"
        style={{
          background:           'rgba(13, 20, 38, 0.98)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight:          '1px solid rgba(59, 130, 246, 0.18)',
          transform:            navOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        aria-hidden={!navOpen}
      >
        {/* Cabeçalho do sidebar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.14)' }}
        >
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="DealsPro" width={24} height={24} className="h-6 w-6 rounded-full" />
            <span className="text-sm font-black uppercase tracking-[0.03em]">
              <span style={{ color: 'var(--text)' }}>DEALS</span>
              <span className="gradient-blue-text">PRO</span>
            </span>
          </div>
          <button onClick={closeNav} className="rounded-lg p-1" style={{ color: 'var(--text-3)' }}>
            <IconClose />
          </button>
        </div>

        {/* Links de navegação */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">

          <SideLink href="/" active={pathname === '/'} onClick={closeNav} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          }>
            Feed de Deals
          </SideLink>

          <SideLink href="/ranking" active={pathname === '/ranking'} onClick={closeNav} icon={<IconRanking />}>
            🔥 Ranking Semanal
          </SideLink>

          <SideLink href="/frete" active={pathname === '/frete'} onClick={closeNav} icon={<IconTruck />}>
            Calculadora de Frete
          </SideLink>

          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeNav}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{ color: 'var(--discord-color)' }}
          >
            <IconDiscord />
            Entrar no Discord
          </a>

          {/* Separador */}
          <div className="my-2 h-px" style={{ background: 'var(--border)' }} />

          {authReady && user && (
            <>
              <SideLink href="/historico" active={pathname === '/historico'} onClick={closeNav} icon={<IconHistory />}>Histórico</SideLink>
              <SideLink href="/pedidos"   active={pathname === '/pedidos'}   onClick={closeNav} icon={<IconBox />}>Pedidos</SideLink>
              <SideLink href="/alerts"    active={pathname === '/alerts'}    onClick={closeNav} icon={<IconBell />}>Alertas</SideLink>
              {isAdmin && (
                <SideLink href="/admin" active={pathname === '/admin'} onClick={closeNav} icon={<IconShield />}>Admin</SideLink>
              )}

              {/* Separador */}
              <div className="my-2 h-px" style={{ background: 'var(--border)' }} />

              {!isPremium && (
                <Link
                  href="/upgrade"
                  onClick={closeNav}
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid rgba(59,130,246,0.3)' }}
                >
                  ⭐ Assinar Premium
                </Link>
              )}

              {isPremium && (
                <div className="px-4 py-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                  >
                    ★ Premium ativo
                  </span>
                </div>
              )}
            </>
          )}

          {authReady && !user && (
            <Link
              href="/login"
              onClick={closeNav}
              className="flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Entrar / Criar conta
            </Link>
          )}
        </nav>

        {/* Footer do sidebar */}
        {user && (
          <div className="p-4" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.12)' }}>
            <p className="mb-3 truncate text-xs" style={{ color: 'var(--text-3)' }}>{user.email}</p>
            <button
              onClick={signOut}
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              Sair
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function SideLink({
  href, active, onClick, icon, children,
}: {
  href: string; active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
      style={
        active
          ? { background: 'rgba(59,130,246,0.12)', color: 'var(--accent-text)' }
          : { color: 'var(--text-2)' }
      }
    >
      <span style={{ color: active ? 'var(--accent-text)' : 'var(--text-3)' }}>{icon}</span>
      {children}
    </Link>
  );
}
