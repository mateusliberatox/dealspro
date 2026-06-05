'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

export function Header() {
  const [user, setUser]           = useState<User | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [authReady, setAuthReady] = useState(false); // evita flash do botão Premium
  const [theme, setTheme]         = useState<'dark' | 'light'>('dark');
  const [menuOpen, setMenuOpen]   = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dp-theme');
    if (saved === 'light') setTheme('light');
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 640) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

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
    setMenuOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dp-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  };

  const closeMenu = () => setMenuOpen(false);
  const pathname  = usePathname();

  return (
    <>
      <header
        className="sticky top-0 z-50 animate-fade-in-down"
        style={{
          background:            'var(--header-bg)',
          backdropFilter:        'blur(14px)',
          WebkitBackdropFilter:  'blur(14px)',
          borderBottom:          '1px solid rgba(59, 130, 246, 0.18)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 animate-slide-in-right" onClick={closeMenu}>
            <Image src="/logo.png" alt="DealsPro" width={32} height={32} priority className="h-8 w-8 rounded-full" />
            <span className="text-[1.05rem] font-black uppercase tracking-[0.03em] leading-none">
              <span style={{ color: 'var(--text)' }}>DEALS</span>
              <span className="gradient-blue-text">PRO</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2 text-sm">

            {/* Ranking — visível para todos */}
            <NavLink href="/ranking" active={pathname === '/ranking'}>
              🔥 Ranking
            </NavLink>

            {/* Discord — visível para todos */}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              style={{ color: 'var(--text-2)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--discord-color)';
                e.currentTarget.style.background = 'rgba(88,101,242,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-2)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discord
            </a>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="rounded-lg p-2 transition-colors"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zm9-9h-2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2zM5 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zm11.95-6.95a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zM7.05 16.95a1 1 0 0 1 0 1.414L5.636 19.778a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zm9.9 0a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414zM7.05 7.05a1 1 0 0 1-1.414 0L4.222 5.636A1 1 0 0 1 5.636 4.222L7.05 5.636a1 1 0 0 1 0 1.414z"/>
                </svg>
              )}
            </button>

            {/* Desktop nav — só renderiza após auth resolver para evitar flash */}
            {authReady && (
              user ? (
                <>
                  <NavLink href="/historico" onClick={closeMenu} active={pathname === '/historico'}>Histórico</NavLink>
                  <NavLink href="/pedidos" onClick={closeMenu} active={pathname === '/pedidos'}>Pedidos</NavLink>
                  <NavLink href="/alerts" onClick={closeMenu} active={pathname === '/alerts'}>Alertas</NavLink>
                  {isAdmin && <NavLink href="/admin" onClick={closeMenu} active={pathname === '/admin'}>Admin</NavLink>}
                  <button
                    onClick={signOut}
                    className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm transition-colors"
                    style={{ color: 'var(--text-3)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                  >
                    Sair
                  </button>
                  <Link
                    href="/minha-conta"
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background:  'var(--surface-2)',
                      border:      '1px solid var(--border)',
                      color:       'var(--text-2)',
                    }}
                  >
                    {isPremium && <span style={{ color: 'var(--accent-text)' }}>★</span>}
                    <span>{user.email?.split('@')[0]}</span>
                  </Link>
                  {!isPremium && (
                    <Link
                      href="/upgrade"
                      className="hidden sm:inline-flex gradient-blue-bright ripple shine-effect rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                    >
                      Premium
                    </Link>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  className="hidden sm:inline-flex gradient-blue-bright ripple shine-effect rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Entrar
                </Link>
              )
            )}

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="sm:hidden rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--text-2)' }}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={closeMenu}
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col animate-slide-in-right sm:hidden"
            style={{
              background:            'rgba(15, 23, 42, 0.97)',
              backdropFilter:        'blur(20px)',
              WebkitBackdropFilter:  'blur(20px)',
              borderLeft:            '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
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
              <button onClick={closeMenu} className="rounded-lg p-1" style={{ color: 'var(--text-3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1 p-3 flex-1">
              <MobileNavLink href="/" onClick={closeMenu} active={pathname === '/'}>Feed de Deals</MobileNavLink>
              <MobileNavLink href="/ranking" onClick={closeMenu} active={pathname === '/ranking'}>🔥 Ranking Semanal</MobileNavLink>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                style={{ color: 'var(--discord-color)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Entrar no Discord
              </a>
              {authReady && (
                user ? (
                  <>
                    <MobileNavLink href="/historico" onClick={closeMenu} active={pathname === '/historico'}>Histórico</MobileNavLink>
                    <MobileNavLink href="/pedidos" onClick={closeMenu} active={pathname === '/pedidos'}>Pedidos</MobileNavLink>
                    <MobileNavLink href="/alerts" onClick={closeMenu} active={pathname === '/alerts'}>Alertas</MobileNavLink>
                    <MobileNavLink href="/minha-conta" onClick={closeMenu} active={pathname === '/minha-conta'}>Minha conta</MobileNavLink>
                    {isAdmin && <MobileNavLink href="/admin" onClick={closeMenu} active={pathname === '/admin'}>Admin</MobileNavLink>}
                    {!isPremium && (
                      <MobileNavLink href="/upgrade" onClick={closeMenu} highlight>
                        Assinar Premium
                      </MobileNavLink>
                    )}
                    {isPremium && (
                      <div className="px-4 py-2 mt-1">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                        >
                          ★ Premium ativo
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <MobileNavLink href="/login" onClick={closeMenu} highlight>Entrar</MobileNavLink>
                )
              )}
            </div>

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
          </div>
        </>
      )}
    </>
  );
}

function NavLink({ href, onClick, children, active }: {
  href: string; onClick?: () => void; children: React.ReactNode; active?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
      style={{
        color:      active ? 'var(--accent-text)' : 'var(--text-2)',
        background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--accent-text)';
        e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color      = active ? 'var(--accent-text)' : 'var(--text-2)';
        e.currentTarget.style.background = active ? 'rgba(59,130,246,0.08)' : 'transparent';
      }}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, onClick, children, highlight = false, active = false }: {
  href: string; onClick: () => void; children: React.ReactNode; highlight?: boolean; active?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all"
      style={
        highlight
          ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' }
          : active
          ? { background: 'rgba(59,130,246,0.08)', color: 'var(--accent-text)' }
          : { color: 'var(--text-2)' }
      }
    >
      {children}
    </Link>
  );
}
