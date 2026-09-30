'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type PatientProfile = {
  id: string;
  email: string;
  full_name: string | null;
  adherence?: number;
  status?: 'green' | 'yellow' | 'red';
  cycleDay?: number;
  topReason?: string;
  planTitle?: string;
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
  patient_id: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
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

const DEFAULT_MEALS: MealItem[] = [
  { id: 'm1', time: '08:00', title: 'Café da Manhã', description: '2 ovos mexidos + 1 fatia de pão integral + Café com leite desnatado' },
  { id: 'm2', time: '12:30', title: 'Almoço', description: '150g de frango grelhado + 4 colheres de arroz integral + Salada à vontade + Azeite' },
  { id: 'm3', time: '16:00', title: 'Lanche da Tarde', description: '1 iogurte natural + 1 fruta (maçã ou pera) + 1 colher de aveia' },
  { id: 'm4', time: '20:00', title: 'Jantar', description: '1 filé de peixe assado + Purê de mandioquinha (3 colheres) + Brócolis no vapor' },
];

const DEMO_PATIENTS: PatientProfile[] = [
  { id: '11111111-1111-1111-1111-111111111111', email: 'mariana.silva@exemplo.com', full_name: 'Mariana Silva', adherence: 88, status: 'green', cycleDay: 8, topReason: 'Não teve tempo (2x)', planTitle: 'Plano de 30 Dias - Emagrecimento' },
  { id: '22222222-2222-2222-2222-222222222222', email: 'carla.souza@exemplo.com', full_name: 'Carla Souza', adherence: 72, status: 'yellow', cycleDay: 14, topReason: 'Estava fora de casa (4x)', planTitle: 'Plano de 30 Dias - Hipertrofia' },
  { id: '33333333-3333-3333-3333-333333333333', email: 'juliana.mendes@exemplo.com', full_name: 'Juliana Mendes', adherence: 52, status: 'red', cycleDay: 22, topReason: 'Esqueci (5x)', planTitle: 'Plano de 30 Dias - Manutenção' },
];

export default function NutriDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nutriName, setNutriName] = useState<string>('Dra. Juliana');
  const [loading, setLoading] = useState(true);

  // Navegação lateral (active tab)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'patients' | 'plans' | 'reports' | 'settings'>('dashboard');

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
        .select('role, full_name, email')
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
      setNutriName(formatDoctorName(profile.full_name, profile.email));

      // Buscar pacientes na tabela profiles onde role = 'patient'
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'patient');

      if (patientError) {
        console.error('Erro ao buscar pacientes no Supabase:', patientError);
      }

      if (patientData && patientData.length > 0) {
        // Enriquecer dados dos pacientes reais com métricas demo/padrão se necessário
        const enriched = patientData.map((p, idx) => {
          const demoFallback = DEMO_PATIENTS[idx % DEMO_PATIENTS.length];
          return {
            ...p,
            adherence: demoFallback?.adherence ?? 80,
            status: demoFallback?.status ?? ('green' as const),
            cycleDay: demoFallback?.cycleDay ?? 10,
            topReason: demoFallback?.topReason ?? 'Nenhum registro crítico',
            planTitle: demoFallback?.planTitle ?? 'Plano Alimentar Padrão',
          };
        });
        setPatients(enriched);
        setSelectedPatientId(enriched[0].id);
      } else {
        setPatients(DEMO_PATIENTS);
        setSelectedPatientId(DEMO_PATIENTS[0].id);
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
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center text-slate-500 font-medium">
        Carregando painel profissional...
      </div>
    );
  }

  // Métricas calculadas
  const totalPatients = patients.length;
  const avgAdherence = totalPatients > 0 ? Math.round(patients.reduce((acc, p) => acc + (p.adherence || 75), 0) / totalPatients) : 0;
  const needAttentionCount = patients.filter(p => (p.adherence || 100) < 60 || p.status === 'red').length;
  const activeInCycleCount = totalPatients; // Todas ativas

  // Pacientes que requerem atenção (< 60% ou status red)
  const attentionPatients = patients.filter(p => (p.adherence || 100) < 60 || p.status === 'red' || p.status === 'yellow');

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* 1. Sidebar Fixa Lateral */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 md:min-h-screen sticky top-0 z-30 shadow-2xs">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <span className="text-3xl">🥗</span>
            <div>
              <span className="font-extrabold text-base text-emerald-950 tracking-tight block">NutriAdesão</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Painel Clínico</span>
            </div>
          </div>

          {/* Links de Navegação */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span>📊</span> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('patients')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === 'patients' ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span>👥</span> Pacientes
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === 'plans' ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span>📋</span> Planos Alimentares
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === 'reports' ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span>📈</span> Relatórios
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <span>⚙️</span> Configurações
            </button>
          </nav>
        </div>

        {/* Rodapé da Sidebar (Perfil e Sair) */}
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

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Barra Superior */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 capitalize">
              {activeTab === 'dashboard' && 'Visão Geral do Consultório'}
              {activeTab === 'patients' && 'Gestão de Pacientes'}
              {activeTab === 'plans' && 'Planos Alimentares'}
              {activeTab === 'reports' && 'Relatórios e Análises'}
              {activeTab === 'settings' && 'Configurações da Conta'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsModalOpen(true); setFeedbackMessage(''); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs md:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 active:scale-[0.98]"
            >
              + Novo Plano Alimentar
            </button>
          </div>
        </header>

        {/* Corpo da Página com Espaçamento Otimizado */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8">

          {/* Feedback de Ações */}
          {feedbackMessage && (
            <div className={`p-4 rounded-2xl text-sm font-medium shadow-2xs animate-fade-in ${feedbackMessage.startsWith('Erro') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
              {feedbackMessage}
            </div>
          )}

          {/* 2. Topo e Saudação Personalizada */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Olá, {nutriName} 👋
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Acompanhe a evolução das suas pacientes e identifique rapidamente quem precisa de atenção.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 px-4 py-2 rounded-2xl border border-emerald-100 text-xs font-bold self-start md:self-auto">
              <span>🟢 Sistema Ativo</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>

          {/* Cards de Métricas em Grid (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Pacientes Totais</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{totalPatients}</span>
                <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">↑ Cadastradas no ciclo</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-xl">👥</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Adesão Média</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{avgAdherence}%</span>
                <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">Ótimo desempenho geral</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-xl">📈</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Precisam de Atenção</span>
                <span className="text-3xl font-extrabold text-rose-600 mt-1 block">{needAttentionCount}</span>
                <span className="text-xs text-rose-500 font-semibold mt-1 inline-block">Adesão abaixo de 60%</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-xl">⚠️</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Ativas no Ciclo</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{activeInCycleCount}</span>
                <span className="text-xs text-teal-600 font-semibold mt-1 inline-block">Ciclo de 30 Dias</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-xl">🔄</div>
            </div>
          </div>

          {/* 4. Seção Destaque "⚠️ Requer Atenção" */}
          {attentionPatients.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-6 md:p-8 shadow-2xs">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h2 className="text-lg font-bold text-amber-900">Pacientes que Requerem Atenção</h2>
                  <p className="text-xs text-amber-700">Identificamos quedas na consistência ou dificuldades recorrentes que merecem uma mensagem de apoio.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attentionPatients.map(p => (
                  <div key={`att-${p.id}`} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 text-sm">{p.full_name || p.email}</h3>
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {p.adherence}% Adesão
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Dificuldade: <span className="font-medium text-rose-700">{p.topReason}</span></p>
                    </div>
                    <button
                      onClick={() => alert(`A abrir chat / detalhes de acompanhamento para ${p.full_name || p.email}`)}
                      className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      Ver acompanhamento →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Lista de Pacientes Otimizada */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Acompanhamento das Pacientes</h2>
              <span className="text-xs text-slate-500 font-medium">{patients.length} pacientes ativas</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {patients.map((p) => {
                const adherence = p.adherence || 80;
                let statusDot = '🟢';
                let statusBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                let statusLabel = 'Boa Adesão';
                let progressBarColor = 'bg-emerald-600';

                if (adherence < 65) {
                  statusDot = '🔴';
                  statusBadgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
                  statusLabel = 'Ponto de Atenção';
                  progressBarColor = 'bg-rose-500';
                } else if (adherence < 80) {
                  statusDot = '🟡';
                  statusBadgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                  statusLabel = 'Adesão Parcial';
                  progressBarColor = 'bg-amber-500';
                }

                return (
                  <div key={p.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-2xs hover:shadow-md transition flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    
                    {/* Info Básica da Paciente */}
                    <div className="flex items-start gap-4 flex-1">
                      <span className="text-3xl mt-1">{statusDot}</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base">{p.full_name || p.email}</h3>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeBg}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Plano: <span className="text-slate-700 font-semibold">{p.planTitle || 'Plano de 30 Dias'}</span> • <span className="text-teal-700 font-bold">Dia {p.cycleDay || 8} de 30</span> do ciclo
                        </p>
                        <p className="text-xs text-slate-600 pt-1">
                          Última dificuldade relatada: <span className="font-semibold text-slate-800">{p.topReason || 'Nenhuma'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Barra de Progresso e Métricas */}
                    <div className="w-full md:w-72 space-y-2 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-500">Adesão Geral</span>
                        <span className="font-extrabold text-slate-900">{adherence}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
                          style={{ width: `${adherence}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Botão de Ação */}
                    <div className="w-full md:w-auto flex justify-end">
                      <button
                        onClick={() => alert(`A abrir detalhes de acompanhamento para ${p.full_name || p.email}`)}
                        className="w-full md:w-auto bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        Ver acompanhamento →
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Lista de Planos Recentes */}
          <div className="space-y-4 pt-4 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Planos Alimentares Recentes</h2>
              <span className="text-xs text-slate-500 font-medium">{recentPlans.length} planos ativos</span>
            </div>

            {recentPlans.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-500 text-sm">
                Nenhum plano alimentar cadastrado ainda. Clique em &ldquo;+ Novo Plano Alimentar&rdquo; acima para começar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentPlans.map((plan) => (
                  <div key={plan.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 text-base">{plan.title}</h3>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                          {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Paciente: <span className="font-semibold text-slate-800">{plan.profiles?.full_name || plan.profiles?.email || 'Paciente'}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Vigência: {plan.start_date} até {plan.end_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modal de Criação de Plano Alimentar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
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
    </div>
  );
}
