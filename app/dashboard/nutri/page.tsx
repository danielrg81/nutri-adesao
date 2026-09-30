'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function NutriDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado da Nutricionista
  const [patients] = useState([
    { id: '1', name: 'Mariana Silva', adherence: 88, status: 'green', cycleDay: 8, topReason: 'Não teve tempo (2x)' },
    { id: '2', name: 'Carla Souza', adherence: 72, status: 'yellow', cycleDay: 14, topReason: 'Estava fora de casa (4x)' },
    { id: '3', name: 'Juliana Mendes', adherence: 55, status: 'red', cycleDay: 22, topReason: 'Esqueci (5x)' },
  ]);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || !profile) {
        router.push('/');
        return;
      }

      if (profile.role === 'patient') {
        router.push('/dashboard/patient');
        return;
      }

      if (profile.role !== 'nutritionist') {
        router.push('/');
        return;
      }

      setUser(session.user);
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Carregando painel da nutricionista...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard/nutri')}>
          <span className="text-2xl">🥗</span>
          <span className="font-bold text-lg text-emerald-900">NutriAdesão</span>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden md:inline">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-medium transition"
            >
              Sair
            </button>
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 md:p-8">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-5 md:p-8 border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-teal-900">Painel da Nutricionista</h1>
              <p className="text-slate-500 text-sm">Acompanhamento de adesão e principais dificuldades das pacientes (Ciclo de 30 dias)</p>
            </div>
            <button
              onClick={() => alert('Módulo de criação de plano alimentar de 30 dias.')}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-4 py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
            >
              + Novo Plano Alimentar
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suas Pacientes Ativas</h2>
            
            <div className="grid gap-4">
              {patients.map((p) => {
                let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                let icon = '🟢';
                if (p.status === 'yellow') {
                  badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                  icon = '🟡';
                }
                if (p.status === 'red') {
                  badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                  icon = '🔴';
                }

                return (
                  <div key={p.id} className="border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 hover:bg-white transition">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{p.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Dia {p.cycleDay} de 30 do ciclo • Principal dificuldade: <span className="font-medium text-slate-700">{p.topReason}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Adesão Geral</span>
                        <span className="text-lg font-extrabold text-slate-800">{p.adherence}%</span>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${badgeColor}`}>
                        {p.status === 'green' ? 'Boa Adesão' : p.status === 'yellow' ? 'Adesão Parcial' : 'Ponto de Atenção'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
