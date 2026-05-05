'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function Header() {
  const [user, setUser]           = useState<User | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [isPremium, setIsPremium] = useState(false);
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
          });
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

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-sm"
        style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center" onClick={closeMenu}>
            <span className="text-[1.0625rem] font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
              DealsPro
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-3)' }}
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

            {/* Desktop nav */}
            {user ? (
              <>
                <Link href="/alerts" className="hidden sm:inline-flex transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                  Alertas
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="hidden sm:inline-flex transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                    Admin
                  </Link>
                )}
                <button onClick={signOut} className="hidden sm:inline-flex transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                  Sair
                </button>
                <Link
                  href="/minha-conta"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
                >
                  {isPremium && <span style={{ color: 'var(--accent-text)' }}>★</span>}
                  <span>{user.email?.split('@')[0]}</span>
                </Link>
                {!isPremium && (
                  <Link href="/upgrade" className="hidden sm:inline-flex btn-accent rounded-lg px-3 py-1.5 text-xs font-bold">
                    Premium
                  </Link>
                )}
              </>
            ) : (
              <Link href="/login" className="hidden sm:inline-flex btn-accent rounded-lg px-4 py-1.5 text-sm font-semibold">
                Entrar
              </Link>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="sm:hidden rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--text-2)' }}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
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
          <div className="fixed inset-0 z-40 sm:hidden" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={closeMenu} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col sm:hidden" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[1.0625rem] font-bold tracking-tight" style={{ color: 'var(--accent)' }}>DealsPro</span>
              <button onClick={closeMenu} className="rounded-lg p-1" style={{ color: 'var(--text-3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-3 flex-1">
              <MobileNavLink href="/" onClick={closeMenu}>Feed de Deals</MobileNavLink>
              {user ? (
                <>
                  <MobileNavLink href="/alerts" onClick={closeMenu}>Alertas</MobileNavLink>
                  <MobileNavLink href="/minha-conta" onClick={closeMenu}>Minha conta</MobileNavLink>
                  {isAdmin && <MobileNavLink href="/admin" onClick={closeMenu}>Admin</MobileNavLink>}
                  {!isPremium && <MobileNavLink href="/upgrade" onClick={closeMenu} highlight>Assinar Premium</MobileNavLink>}
                  {isPremium && (
                    <div className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                        ★ Premium ativo
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <MobileNavLink href="/login" onClick={closeMenu} highlight>Entrar</MobileNavLink>
              )}
            </div>
            {user && (
              <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-3 truncate text-xs" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                <button
                  onClick={signOut}
                  className="w-full rounded-xl border py-2.5 text-sm font-medium transition-colors"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}
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

function MobileNavLink({ href, onClick, children, highlight = false }: {
  href: string; onClick: () => void; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
      style={
        highlight
          ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' }
          : { color: 'var(--text-2)' }
      }
    >
      {children}
    </Link>
  );
}
