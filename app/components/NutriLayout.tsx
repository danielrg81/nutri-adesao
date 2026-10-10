'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

  useEffect(() => {
    if (propUser) {
      setUser(propUser);
      if (propNutriName) setNutriName(propNutriName);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('⚠️ [NutriLayout] Timeout de segurança de carregamento (3.5s) acionado.');
        setLoading(false);
      }
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

        if (error || !profile) {
          console.error('❌ [NutriLayout] Erro ao carregar perfil:', error);
          router.push('/login');
          return;
        }

        if (profile.role === 'patient') {
          router.push('/dashboard/patient');
          return;
        }

        if (profile.role !== 'nutritionist') {
          router.push('/login');
          return;
        }

        setUser(session.user);
        setNutriName(formatDoctorName(profile.full_name, session.user.email));
      } catch (err) {
        console.error('❌ [NutriLayout] Exceção em checkAuth:', err);
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
    { label: 'Dashboard', href: '/dashboard/nutri', icon: '📊' },
    { label: 'Pacientes', href: '/dashboard/pacientes', icon: '👥' },
    { label: 'Planos Alimentares', href: '/dashboard/planos', icon: '📋' },
    { label: 'Relatórios', href: '/dashboard/relatorios', icon: '📈' },
    { label: 'Configurações', href: '/dashboard/configuracoes', icon: '⚙️' },
  ];
  
  // Função para verificar se um item de navegação está ativo
  const isNavItemActive = (href: string) => {
    // Para Dashboard, só ativa se for exatamente /dashboard/nutri
    if (href === '/dashboard/nutri') {
      return pathname === '/dashboard/nutri';
    }
    // Para outros itens, verifica se o pathname começa com o href
    return pathname === href || pathname?.startsWith(href + '/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center text-slate-500 font-medium">
        Carregando painel profissional...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard/nutri')}>
          <span className="text-2xl">🥗</span>
          <span className="font-extrabold text-sm text-emerald-950">NutriAdesão</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition focus:outline-none"
          aria-label="Abrir Menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex md:hidden">
          <div className="w-72 bg-white h-full shadow-2xl flex flex-col justify-between p-6 animate-slide-right">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥗</span>
                  <div>
                    <span className="font-extrabold text-sm text-emerald-950 block">NutriAdesão</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Painel Clínico</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <nav className="py-6 space-y-2">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item.href);
                  return (
                    <button
                      key={item.href}
                      onClick={() => { setMobileMenuOpen(false); router.push(item.href); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${isActive ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      <span>{item.icon}</span> {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-6 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 p-6">
              <div className="mb-3 truncate">
                <span className="font-bold text-xs text-slate-800 block truncate">{nutriName}</span>
                <span className="text-[11px] text-slate-500 block truncate">{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-2"
              >
                🚪 Sair da conta
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col justify-between shrink-0 min-h-screen sticky top-0 z-30 shadow-2xs">
        <div>
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard/nutri')}>
            <span className="text-3xl">🥗</span>
            <div>
              <span className="font-extrabold text-base text-emerald-950 tracking-tight block">NutriAdesão</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Painel Clínico</span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${isActive ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="truncate">
              <span className="font-bold text-xs text-slate-800 block truncate">{nutriName}</span>
              <span className="text-[11px] text-slate-500 block truncate">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-semibold py-2 px-3 rounded-xl transition shadow-2xs flex items-center justify-center gap-2"
          >
            🚪 Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
}
