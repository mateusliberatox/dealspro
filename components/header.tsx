'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function Header() {
  const [user, setUser]   = useState<User | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Sync theme state with what the layout script applied
    const saved = localStorage.getItem('dp-theme');
    if (saved === 'light') setTheme('light');
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dp-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  };

  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur-sm" style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-orange-500">DealsPro</span>
          <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            Beta
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
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

          {user ? (
            <>
              <Link href="/alerts" className="transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                Alertas
              </Link>
              <Link href="/admin" className="transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                Admin
              </Link>
              <button onClick={signOut} className="transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                Sair
              </button>
              <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">
                {user.email?.split('@')[0]}
              </span>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
