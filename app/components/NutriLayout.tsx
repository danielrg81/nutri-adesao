'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type NutriLayoutProps = {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
  user?: User | null;
  nutriName?: string;
};

function formatDoctorName(fullName?: string | null, email?: string | null): string {
  if (fullName && fullName.trim().length > 0) {
    const cleanName = fullName.replace(/^(dra?\.?\s*)/i, '').trim();
    return `Dra. ${cleanName}`;
  }
  if (email) {
    const handle = email.split('@')[0].replace(/[0-9_.-]/g, ' ').trim();
    const capitalized = handle
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (capitalized.length > 0) {
      return `Dra. ${capitalized}`;
    }
  }
  return 'Dra. Juliana';
}

export default function NutriLayout({ children, title, actions, user: propUser, nutriName: propNutriName }: NutriLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(propUser || null);
  const [nutriName, setNutriName] = useState<string>(propNutriName || 'Dra. Juliana');
  const [loading, setLoading] = useState(!propUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const isNowDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isNowDark);
    localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
  };

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
      if (propNutriName) setNutriName(propNutriName);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) setLoading(false);
    }, 3500);

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single();

        if (!isMounted) return;
        if (error || !profile || profile.role !== 'nutritionist') {
          router.push('/login');
          return;
        }

        setUser(session.user);
        setNutriName(formatDoctorName(profile.full_name, session.user.email));
      } catch (err) {
        router.push('/login');
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [router, propUser, propNutriName]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/nutri', icon: '📊', badge: 'Página inicial' },
    { label: 'Pacientes', href: '/dashboard/pacientes', icon: '👥' },
    { label: 'Planos Alimentares', href: '/dashboard/planos', icon: '📋' },
    { label: 'Consultas', href: '/dashboard/relatorios', icon: '📅' },
    { label: 'Configurações', href: '/dashboard/configuracoes', icon: '⚙️' },
  ];

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard/nutri') return pathname === '/dashboard/nutri';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 flex items-center justify-center text-slate-500 font-medium">
        Carregando painel profissional...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard/nutri" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <span className="text-lg">🌿</span>
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">NutriAdesão</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Sistema de gestão nutricional</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          {/* Top Profile / Brand Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <Link href="/dashboard/nutri" className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400">
                  <span>🌿</span>
                </div>
                <div className="text-left">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block group-hover:text-emerald-600 transition">NutriAdesão</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[140px]">Sistema de gestão nutricional</span>
                </div>
              </div>
              <span className="text-slate-400 text-xs">▼</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions (Settings, Theme Toggle & Logout) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            <div className="flex items-center gap-3">
              <span>{isDarkMode ? '☀️' : '🌙'}</span>
              <span>Aparência</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
              {isDarkMode ? 'Modo Escuro' : 'Modo Claro'}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
          >
            <span>🚪</span>
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <div className="flex items-center gap-3">{actions}</div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
}
