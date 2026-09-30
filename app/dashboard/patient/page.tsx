'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Meal = {
  id: string;
  time: string;
  title: string;
  description: string;
};

type MealRecord = {
  status: 'success' | 'failed';
  reason?: string;
};

const DEFAULT_MEALS: Meal[] = [
  { id: 'm1', time: '08:00', title: 'Café da Manhã', description: '2 ovos mexidos + 1 fatia de pão integral + Café com leite desnatado' },
  { id: 'm2', time: '12:30', title: 'Almoço', description: '150g de frango grelhado + 4 colheres de arroz integral + Salada à vontade + Azeite' },
  { id: 'm3', time: '16:00', title: 'Lanche da Tarde', description: '1 iogurte natural + 1 fruta (maçã ou pera) + 1 colher de aveia' },
  { id: 'm4', time: '20:00', title: 'Jantar', description: '1 filé de peixe assado + Purê de mandioquinha (3 colheres) + Brócolis no vapor' },
];

const REASONS = [
  'Esqueci',
  'Não tive tempo',
  'Estava fora de casa',
  'Não tinha os alimentos',
  'Não estava com fome',
  'Outro'
];

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado da Paciente
  const [currentDay] = useState(8);
  const [records, setRecords] = useState<Record<string, MealRecord>>({});
  const [activeFailedMeal, setActiveFailedMeal] = useState<string | null>(null);

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

      if (profile.role === 'nutritionist') {
        router.push('/dashboard/nutri');
        return;
      }

      if (profile.role !== 'patient') {
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

  const handleCheckin = (mealId: string, status: 'success' | 'failed' | null, reason?: string) => {
    if (status === null) {
      setRecords(prev => {
        const copy = { ...prev };
        delete copy[mealId];
        return copy;
      });
    } else {
      setRecords(prev => ({
        ...prev,
        [mealId]: { status, reason }
      }));
    }
    setActiveFailedMeal(null);
  };

  const completedCount = Object.values(records).filter(r => r.status).length;
  const successCount = Object.values(records).filter(r => r.status === 'success').length;
  const adherencePercentage = DEFAULT_MEALS.length > 0 ? Math.round((successCount / DEFAULT_MEALS.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Carregando painel da paciente...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard/patient')}>
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
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
          {/* Topo do Ciclo */}
          <div className="bg-emerald-600 text-white p-5 md:p-6 text-center">
            <span className="bg-emerald-500/50 text-xs px-3 py-1 rounded-full font-medium uppercase tracking-wider">
              Ciclo de 30 Dias
            </span>
            <h2 className="text-3xl font-bold mt-2">Dia {currentDay} de 30</h2>
            <p className="text-emerald-100 text-xs mt-1">Foco na consistência, sem julgamentos!</p>
            
            {/* Resumo de Adesão do Dia */}
            <div className="mt-4 bg-emerald-700/60 rounded-xl p-3 flex justify-around text-xs">
              <div>
                <span className="block text-emerald-200">Refeições Registradas</span>
                <span className="font-bold text-base">{completedCount} / {DEFAULT_MEALS.length}</span>
              </div>
              <div className="border-l border-emerald-500/50"></div>
              <div>
                <span className="block text-emerald-200">Adesão do Dia</span>
                <span className="font-bold text-base">{adherencePercentage}%</span>
              </div>
            </div>
          </div>

          {/* Lista de Refeições */}
          <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto max-h-[550px]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Plano de Hoje</h3>
            
            {DEFAULT_MEALS.map((meal) => {
              const record = records[meal.id];
              return (
                <div key={meal.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 hover:bg-white transition shadow-2xs">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {meal.time}
                      </span>
                      <h4 className="font-bold text-slate-800 text-base mt-1.5">{meal.title}</h4>
                    </div>
                    {record?.status === 'success' && (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        ✓ Consegui
                      </span>
                    )}
                    {record?.status === 'failed' && (
                      <span className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        ✕ Não consegui ({record.reason})
                      </span>
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-slate-600 mb-4 leading-relaxed">{meal.description}</p>

                  {!record?.status ? (
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleCheckin(meal.id, 'success')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold py-3 px-4 rounded-xl transition shadow-xs active:scale-[0.98] min-h-[44px] flex items-center justify-center gap-1.5"
                      >
                        ✨ Consegui
                      </button>
                      <button
                        onClick={() => setActiveFailedMeal(meal.id)}
                        className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs md:text-sm font-semibold py-3 px-4 rounded-xl transition active:scale-[0.98] min-h-[44px] flex items-center justify-center"
                      >
                        Não consegui
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckin(meal.id, null)}
                      className="text-xs text-slate-400 hover:text-slate-600 underline w-full text-center py-2"
                    >
                      Desfazer registro
                    </button>
                  )}

                  {activeFailedMeal === meal.id && (
                    <div className="mt-3 bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm animate-fade-in">
                      <p className="text-xs font-semibold text-rose-700 mb-2.5">O que dificultou nesta refeição?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {REASONS.map((reason) => (
                          <button
                            key={reason}
                            onClick={() => handleCheckin(meal.id, 'failed', reason)}
                            className="text-left text-xs font-medium bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-700 p-3 rounded-xl border border-slate-200 hover:border-rose-200 transition min-h-[44px] flex items-center active:scale-[0.98]"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
