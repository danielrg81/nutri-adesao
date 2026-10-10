'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import NutriLayout from '@/app/components/NutriLayout';

type MealItem = {
  id: string;
  time: string;
  title: string;
  description: string;
};

type MealPlan = {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  meals_json: MealItem[];
  patient_id?: string;
  cycles?: {
    id: string;
    patient_id: string;
    profiles?: {
      full_name?: string;
    };
  };
  profiles?: {
    full_name?: string;
  };
};

export default function PlanosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      try {
        let userData: any = null;
        try {
          const res = await supabase.auth.getUser();
          userData = res.data;
        } catch (authErr) {
          console.error('Erro auth:', authErr);
        }

        if (!userData?.user) {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const currentUser = userData.user;
        if (isMounted) setUser(currentUser);

        let plansData: any[] | null = null;

        try {
          let res: any = null;
          try {
            res = await supabase
              .from('meal_plans')
              .select('*, cycles!inner(id, patient_id, profiles:patient_id(full_name))')
              .eq('cycles.nutritionist_id', currentUser.id)
              .order('created_at', { ascending: false });
          } catch (err: any) {
            res = { data: null, error: err };
          }

          plansData = res?.data;

          if (res?.error || !plansData || plansData.length === 0) {
            let fallbackRes: any = null;
            try {
              fallbackRes = await supabase
                .from('meal_plans')
                .select('*, profiles:patient_id(full_name)')
                .eq('nutritionist_id', currentUser.id)
                .order('created_at', { ascending: false });
            } catch (err: any) {
              fallbackRes = { data: null, error: err };
            }

            if (fallbackRes?.data && fallbackRes.data.length > 0) {
              plansData = fallbackRes.data;
            } else {
              let basicRes: any = null;
              try {
                basicRes = await supabase
                  .from('meal_plans')
                  .select('*')
                  .eq('nutritionist_id', currentUser.id)
                  .order('created_at', { ascending: false });
              } catch (err: any) {
                basicRes = { data: null, error: err };
              }
              if (basicRes?.data) {
                plansData = basicRes.data;
              }
            }
          }
        } catch (queryErr) {
          console.error('❌ [PlanosPage] Exceção ao consultar meal_plans:', queryErr);
        }

        if (isMounted) {
          setPlans((plansData as MealPlan[]) || []);
        }
      } catch (err) {
        console.error('❌ [PlanosPage] Exceção em loadPlans:', err);
        if (isMounted) {
          setErrorMessage('Erro ao carregar planos alimentares.');
          setPlans([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center text-slate-500 font-medium">
        Carregando planos alimentares...
      </div>
    );
  }

  return (
    <NutriLayout title="Planos Alimentares" user={user}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Planos Alimentares 📋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Gestão e histórico de planos alimentares criados para as suas pacientes.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/nutri')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm px-4 py-2.5 rounded-xl transition shadow-xs self-start md:self-auto"
          >
            + Criar Novo Plano
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-2xl text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
            {errorMessage}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
            <div className="text-4xl">📂</div>
            <h3 className="text-base font-bold text-slate-900">Nenhum registo encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não existem planos alimentares cadastrados no momento. Clique em &ldquo;+ Criar Novo Plano&rdquo; acima.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-lg">{plan.title}</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                      {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Paciente: <span className="font-semibold text-slate-800">{plan.cycles?.profiles?.full_name || plan.profiles?.full_name || 'Paciente'}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Vigência: {plan.start_date} {plan.end_date ? `até ${plan.end_date}` : ''}
                  </p>
                </div>
                {Array.isArray(plan.meals_json) && plan.meals_json.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Refeições Principais</span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {plan.meals_json.map((m, idx) => (
                        <div key={idx} className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{m.time} - {m.title}</span>
                          <span className="text-slate-400 truncate max-w-[180px]">{m.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </NutriLayout>
  );
}
