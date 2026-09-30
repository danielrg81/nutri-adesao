'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type PatientProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

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
  end_date: string;
  meals_json: MealItem[];
  profiles?: {
    full_name?: string;
    email?: string;
  };
};

const DEFAULT_MEALS: MealItem[] = [
  { id: 'm1', time: '08:00', title: 'Café da Manhã', description: '2 ovos mexidos + 1 fatia de pão integral + Café com leite desnatado' },
  { id: 'm2', time: '12:30', title: 'Almoço', description: '150g de frango grelhado + 4 colheres de arroz integral + Salada à vontade + Azeite' },
  { id: 'm3', time: '16:00', title: 'Lanche da Tarde', description: '1 iogurte natural + 1 fruta (maçã ou pera) + 1 colher de aveia' },
  { id: 'm4', time: '20:00', title: 'Jantar', description: '1 filé de peixe assado + Purê de mandioquinha (3 colheres) + Brócolis no vapor' },
];

export default function NutriDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Pacientes e Planos
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [recentPlans, setRecentPlans] = useState<MealPlan[]>([]);

  // Modal de Novo Plano
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [planTitle, setPlanTitle] = useState('Plano de 30 Dias');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [meals, setMeals] = useState<MealItem[]>(DEFAULT_MEALS);

  // Feedback e submissão
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    async function checkAuthAndFetchData() {
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

      // Buscar pacientes reais
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'patient');

      if (patientError) {
        console.error('Erro ao buscar pacientes:', patientError);
      } else if (patientData) {
        setPatients(patientData);
        if (patientData.length > 0) {
          setSelectedPatientId(patientData[0].id);
        }
      }

      // Buscar planos criados recentemente
      const { data: plansData, error: plansError } = await supabase
        .from('meal_plans')
        .select('*, profiles:patient_id(full_name, email)')
        .eq('nutritionist_id', session.user.id)
        .order('created_at', { ascending: false });

      if (plansError) {
        console.error('Erro ao buscar planos alimentares:', plansError);
      } else if (plansData) {
        setRecentPlans(plansData as MealPlan[]);
      }

      setLoading(false);
    }

    checkAuthAndFetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleMealChange = (index: number, field: keyof MealItem, value: string) => {
    const updated = [...meals];
    updated[index] = { ...updated[index], [field]: value };
    setMeals(updated);
  };

  const handleAddMeal = () => {
    setMeals(prev => [
      ...prev,
      { id: `m_${Date.now()}`, time: '10:00', title: 'Lanche da Manhã', description: 'Ex: 1 punhado de castanhas' }
    ]);
  };

  const handleRemoveMeal = (index: number) => {
    setMeals(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedPatientId) {
      setFeedbackMessage('Selecione uma paciente.');
      return;
    }

    setSubmitting(true);
    setFeedbackMessage('');

    const { error } = await supabase.from('meal_plans').insert({
      patient_id: selectedPatientId,
      nutritionist_id: user.id,
      title: planTitle,
      start_date: startDate,
      end_date: endDate,
      meals_json: meals,
    });

    setSubmitting(false);

    if (error) {
      console.error('Erro ao criar plano:', error);
      setFeedbackMessage(`Erro ao gravar plano: ${error.message}`);
    } else {
      setFeedbackMessage('✨ Plano alimentar criado e gravado com sucesso!');
      setIsModalOpen(false);

      // Recarregar planos recentes
      const { data: plansData } = await supabase
        .from('meal_plans')
        .select('*, profiles:patient_id(full_name, email)')
        .eq('nutritionist_id', user.id)
        .order('created_at', { ascending: false });

      if (plansData) {
        setRecentPlans(plansData as MealPlan[]);
      }
    }
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
              onClick={() => { setIsModalOpen(true); setFeedbackMessage(''); }}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-4 py-3 rounded-xl transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
            >
              + Novo Plano Alimentar
            </button>
          </div>

          {feedbackMessage && (
            <div className={`mb-6 p-4 rounded-xl text-xs md:text-sm font-medium ${feedbackMessage.startsWith('Erro') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
              {feedbackMessage}
            </div>
          )}

          {/* Lista de Planos Recentes */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Planos Alimentares Criados</h2>
            
            {recentPlans.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm">
                Nenhum plano alimentar cadastrado ainda. Clique em &ldquo;+ Novo Plano Alimentar&rdquo; para começar.
              </div>
            ) : (
              <div className="grid gap-4">
                {recentPlans.map((plan) => (
                  <div key={plan.id} className="border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 hover:bg-white transition">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{plan.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Paciente: <span className="font-medium text-slate-700">{plan.profiles?.full_name || plan.profiles?.email || 'Paciente'}</span> • Vigência: {plan.start_date} até {plan.end_date}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-teal-50 text-teal-800 border-teal-200">
                      {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Plano Ativo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de Pacientes Ativas */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pacientes Cadastradas</h2>
            
            {patients.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm">
                Nenhuma paciente cadastrada no sistema ainda.
              </div>
            ) : (
              <div className="grid gap-4">
                {patients.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 hover:bg-white transition">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🟢</span>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{p.full_name || 'Paciente sem nome'}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">E-mail: <span className="font-medium text-slate-700">{p.email}</span></p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl border bg-emerald-100 text-emerald-800 border-emerald-200">
                      Ativa
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação de Plano Alimentar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-teal-900">Criar Novo Plano Alimentar</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selecionar Paciente</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  {patients.length === 0 ? (
                    <option value="">Nenhuma paciente cadastrada</option>
                  ) : (
                    patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Título do Plano</label>
                  <input
                    type="text"
                    required
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Início</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Término</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Refeições do Plano</label>
                  <button
                    type="button"
                    onClick={handleAddMeal}
                    className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    + Adicionar Refeição
                  </button>
                </div>

                <div className="space-y-3">
                  {meals.map((meal, index) => (
                    <div key={meal.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            required
                            value={meal.time}
                            onChange={(e) => handleMealChange(index, 'time', e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                          <input
                            type="text"
                            required
                            value={meal.title}
                            onChange={(e) => handleMealChange(index, 'title', e.target.value)}
                            placeholder="Nome da Refeição (ex: Almoço)"
                            className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white flex-1"
                          />
                        </div>
                        {meals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMeal(index)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <textarea
                        required
                        value={meal.description}
                        onChange={(e) => handleMealChange(index, 'description', e.target.value)}
                        placeholder="Descrição dos alimentos (ex: 150g frango + salada)"
                        rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      ></textarea>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'A gravar...' : 'Gravar Plano Alimentar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
