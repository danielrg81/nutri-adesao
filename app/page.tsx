'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Meal = {
  id: string;
  time: string;
  title: string;
  description: string;
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

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'patient' | 'nutritionist' | null>(null);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'select' | 'patient-login' | 'nutritionist-login'>('select');

  // Formulários
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // Estado da Paciente
  const [currentDay, setCurrentDay] = useState(8);
  const [records, setRecords] = useState<Record<string, { status: 'success' | 'failed'; reason?: string }>>({});
  const [activeFailedMeal, setActiveFailedMeal] = useState<string | null>(null);

  // Estado da Nutricionista
  const [patients, setPatients] = useState([
    { id: '1', name: 'Mariana Silva', adherence: 88, status: 'green', cycleDay: 8, topReason: 'Não teve tempo (2x)' },
    { id: '2', name: 'Carla Souza', adherence: 72, status: 'yellow', cycleDay: 14, topReason: 'Estava fora de casa (4x)' },
    { id: '3', name: 'Juliana Mendes', adherence: 55, status: 'red', cycleDay: 22, topReason: 'Esqueci (5x)' },
  ]);

  useEffect(() => {
    // Verificar sessão ativa no Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const role = session.user.user_metadata?.role || 'patient';
        setUserRole(role);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setUserRole(session.user.user_metadata?.role || 'patient');
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePatientMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { role: 'patient' }
      }
    });

    setLoading(false);
    if (error) {
      setMessage(`Erro: ${error.message}`);
    } else {
      setMessage('✨ Link mágico enviado! Verifique seu e-mail para entrar.');
    }
  };

  const handleNutritionistLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setMessage(`Erro ao entrar: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setAuthMode('select');
  };

  const handleCheckin = (mealId: string, status: 'success' | 'failed', reason?: string) => {
    setRecords(prev => ({
      ...prev,
      [mealId]: { status, reason }
    }));
    setActiveFailedMeal(null);
  };

  const completedCount = Object.values(records).filter(r => r.status).length;
  const successCount = Object.values(records).filter(r => r.status === 'success').length;
  const adherencePercentage = DEFAULT_MEALS.length > 0 ? Math.round((successCount / DEFAULT_MEALS.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setUserRole(null); setAuthMode('select'); }}>
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
        
        {/* Se o usuário não estiver autenticado, exibe telas de login / seleção */}
        {!user ? (
          <>
            {authMode === 'select' && (
              <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-slate-100 text-center animate-fade-in">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Bem-vinda ao NutriAdesão</h1>
                <p className="text-slate-500 text-sm mb-6">Selecione seu perfil para acessar o sistema:</p>
                
                <div className="space-y-4">
                  <button
                    onClick={() => setAuthMode('patient-login')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold p-4 rounded-xl shadow-md transition flex items-center justify-between group active:scale-[0.98]"
                  >
                    <div className="text-left">
                      <div className="text-base font-bold">👩‍⚕️ Sou Paciente</div>
                      <div className="text-xs text-emerald-100 font-normal">Acesso rápido sem senha (Link Mágico)</div>
                    </div>
                    <span className="text-xl group-hover:translate-x-1 transition">→</span>
                  </button>

                  <button
                    onClick={() => setAuthMode('nutritionist-login')}
                    className="w-full bg-teal-800 hover:bg-teal-900 text-white font-semibold p-4 rounded-xl shadow-md transition flex items-center justify-between group active:scale-[0.98]"
                  >
                    <div className="text-left">
                      <div className="text-base font-bold">📋 Sou Nutricionista</div>
                      <div className="text-xs text-teal-200 font-normal">Acesso ao painel administrativo (E-mail e Senha)</div>
                    </div>
                    <span className="text-xl group-hover:translate-x-1 transition">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* Login Paciente (Magic Link) */}
            {authMode === 'patient-login' && (
              <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-slate-100 animate-fade-in">
                <button
                  onClick={() => { setAuthMode('select'); setMessage(''); }}
                  className="text-xs text-emerald-600 hover:underline mb-4 block font-medium"
                >
                  ← Voltar
                </button>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Acesso da Paciente</h2>
                <p className="text-slate-500 text-xs mb-6">Digite seu e-mail para receber um link de acesso imediato, sem precisar criar senha.</p>

                <form onSubmit={handlePatientMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail cadastrado</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {message && (
                    <div className={`p-3 rounded-xl text-xs font-medium ${message.startsWith('Erro') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {loading ? 'Enviando...' : 'Enviar Link de Acesso'}
                  </button>
                </form>
              </div>
            )}

            {/* Login Nutricionista (E-mail e Senha) */}
            {authMode === 'nutritionist-login' && (
              <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-slate-100 animate-fade-in">
                <button
                  onClick={() => { setAuthMode('select'); setMessage(''); }}
                  className="text-xs text-teal-700 hover:underline mb-4 block font-medium"
                >
                  ← Voltar
                </button>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Painel da Nutricionista</h2>
                <p className="text-slate-500 text-xs mb-6">Entre com seu e-mail e senha de profissional.</p>

                <form onSubmit={handleNutritionistLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail profissional</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nutri@exemplo.com"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {message && (
                    <div className="p-3 rounded-xl text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-800 hover:bg-teal-900 text-white font-semibold py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {loading ? 'Entrando...' : 'Entrar no Painel'}
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          /* Telas Logadas (Paciente ou Nutricionista) */
          <>
            {userRole === 'patient' ? (
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
                            onClick={() => handleCheckin(meal.id, null as any)}
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
            ) : (
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
            )}
          </>
        )}

      </div>
    </main>
  );
}
