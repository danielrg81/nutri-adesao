'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TIPOS
// ============================================================================

type PatientProfile = {
  id: string;
  email?: string;
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

// Campos espelhando exatamente o schema do banco (sem notes — coluna não existe)
type MealPlan = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  title: string;
  start_date: string;
  end_date: string;
  meals_json: MealItem[];
  profiles?: { full_name?: string };
  cycles?: {
    id: string;
    patient_id: string;
    profiles?: { full_name?: string };
  };
};

// Views com aliases em português e inglês
type ViewType =
  | 'dashboard' | 'inicio'
  | 'patients'  | 'pacientes'
  | 'meal-plans'| 'planos'
  | 'reports'   | 'relatorios'
  | 'settings'  | 'configuracoes';

type NormalizedView = 'dashboard' | 'patients' | 'meal-plans' | 'reports' | 'settings';

type Toast = {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'warning' | 'info';
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/** Normaliza qualquer alias de view para o seu valor canónico. */
function normalizeView(v: ViewType): NormalizedView {
  const map: Record<ViewType, NormalizedView> = {
    dashboard: 'dashboard', inicio: 'dashboard',
    patients:  'patients',  pacientes: 'patients',
    'meal-plans': 'meal-plans', planos: 'meal-plans',
    reports:   'reports',   relatorios: 'reports',
    settings:  'settings',  configuracoes: 'settings',
  };
  return map[v] ?? 'dashboard';
}

function formatDoctorName(fullName?: string | null, email?: string | null): string {
  if (fullName?.trim()) {
    return `Dra. ${fullName.replace(/^(dra?\.?\s*)/i, '').trim()}`;
  }
  if (email) {
    const handle = email
      .split('@')[0]
      .replace(/[0-9_.-]/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    if (handle) return `Dra. ${handle}`;
  }
  return 'Dra. Juliana';
}

const DEFAULT_MEALS: MealItem[] = [
  { id: 'm1', time: '08:00', title: 'Café da Manhã',  description: '2 ovos mexidos + 1 fatia de pão integral + Café com leite desnatado' },
  { id: 'm2', time: '12:30', title: 'Almoço',         description: '150g de frango grelhado + 4 col. arroz integral + Salada à vontade + Azeite' },
  { id: 'm3', time: '16:00', title: 'Lanche da Tarde',description: '1 iogurte natural + 1 fruta (maçã ou pera) + 1 col. de aveia' },
  { id: 'm4', time: '20:00', title: 'Jantar',         description: '1 filé de peixe assado + Purê de mandioquinha (3 col.) + Brócolis no vapor' },
];

const DEMO_PATIENTS: PatientProfile[] = [
  { id: '11111111-1111-1111-1111-111111111111', email: 'mariana.silva@exemplo.com',  full_name: 'Mariana Silva',   adherence: 88, status: 'green',  cycleDay: 8,  topReason: 'Não teve tempo (2x)',         planTitle: 'Plano de 30 Dias - Emagrecimento' },
  { id: '22222222-2222-2222-2222-222222222222', email: 'carla.souza@exemplo.com',    full_name: 'Carla Souza',     adherence: 72, status: 'yellow', cycleDay: 14, topReason: 'Estava fora de casa (4x)',   planTitle: 'Plano de 30 Dias - Hipertrofia'   },
  { id: '33333333-3333-3333-3333-333333333333', email: 'juliana.mendes@exemplo.com', full_name: 'Juliana Mendes', adherence: 52, status: 'red',    cycleDay: 22, topReason: 'Esqueci (5x)',               planTitle: 'Plano de 30 Dias - Manutenção'    },
];

// ============================================================================
// COMPONENTE DE TOAST
// ============================================================================

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 6000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const styles: Record<Toast['kind'], string> = {
    success: 'bg-emerald-50  border-emerald-200 text-emerald-800',
    error:   'bg-rose-50     border-rose-200    text-rose-800',
    warning: 'bg-amber-50    border-amber-200   text-amber-800',
    info:    'bg-blue-50     border-blue-200    text-blue-800',
  };
  const icons: Record<Toast['kind'], string> = {
    success: '✓', error: '✕', warning: '⚠', info: 'ℹ',
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg max-w-sm ${styles[toast.kind]}`}>
      <span className="text-base font-bold mt-0.5 shrink-0">{icons[toast.kind]}</span>
      <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 font-bold text-xs"
        aria-label="Fechar"
      >✕</button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// VIEWS
// ============================================================================

function DashboardView({
  nutriName, patients, recentPlans, onNavigate, onCreatePlan,
}: {
  nutriName: string;
  patients: PatientProfile[];
  recentPlans: MealPlan[];
  onNavigate: (v: ViewType) => void;
  onCreatePlan: () => void;
}) {
  const total        = patients.length;
  const avgAdherence = total > 0 ? Math.round(patients.reduce((s, p) => s + (p.adherence ?? 75), 0) / total) : 0;
  const needAttn     = patients.filter(p => (p.adherence ?? 100) < 60 || p.status === 'red').length;
  const attnList     = patients.filter(p => (p.adherence ?? 100) < 60 || p.status === 'red' || p.status === 'yellow');

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Olá, {nutriName} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Acompanhe a evolução das suas pacientes e identifique rapidamente quem precisa de atenção.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 px-4 py-2 rounded-2xl border border-emerald-100 text-xs font-bold self-start md:self-auto">
          <span>🟢 Sistema Ativo</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Pacientes Totais',    value: total,        sub: '↑ Cadastradas',   icon: '👥', color: 'bg-emerald-50' },
          { label: 'Adesão Média',        value: `${avgAdherence}%`, sub: 'Desempenho geral', icon: '📈', color: 'bg-teal-50' },
          { label: 'Precisam de Atenção', value: needAttn,     sub: 'Adesão < 60%',    icon: '⚠️', color: 'bg-rose-50', valueClass: 'text-rose-600' },
          { label: 'Ativas no Ciclo',     value: total,        sub: 'Ciclo de 30 Dias',icon: '🔄', color: 'bg-teal-50' },
        ].map(card => (
          <div key={card.label} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">{card.label}</span>
              <span className={`text-3xl font-extrabold mt-1 block ${card.valueClass ?? 'text-slate-900'}`}>{card.value}</span>
              <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">{card.sub}</span>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${card.color} flex items-center justify-center text-xl shrink-0`}>{card.icon}</div>
          </div>
        ))}
      </div>

      {/* Atenção */}
      {attnList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-6 md:p-8 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="text-lg font-bold text-amber-900">Pacientes que Requerem Atenção</h2>
              <p className="text-xs text-amber-700">Identificamos quedas na consistência ou dificuldades recorrentes.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attnList.map(p => (
              <div key={`attn-${p.id}`} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-2xs flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">{p.full_name || p.email}</h3>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">{p.adherence}%</span>
                  </div>
                  <p className="text-xs text-slate-500">Dificuldade: <span className="font-medium text-rose-700">{p.topReason}</span></p>
                </div>
                <button
                  onClick={() => onNavigate('patients')}
                  className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs py-2 rounded-xl transition"
                >
                  Ver pacientes →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planos recentes */}
      <div className="space-y-4 pt-4 border-t border-slate-200/85">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Planos Alimentares Recentes</h2>
          <button onClick={() => onNavigate('meal-plans')} className="text-xs text-emerald-700 font-bold hover:underline">Ver todos →</button>
        </div>
        {recentPlans.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-500 text-sm">
            Nenhum plano cadastrado. Clique em &ldquo;+ Novo Plano Alimentar&rdquo; acima.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentPlans.slice(0, 4).map(plan => (
              <div key={plan.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-base">{plan.title}</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                    {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Paciente: <span className="font-semibold text-slate-800">{plan.cycles?.profiles?.full_name ?? plan.profiles?.full_name ?? '—'}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {plan.start_date} até {plan.end_date}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientsView({ patients }: { patients: PatientProfile[] }) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Pacientes Cadastradas 👥</h1>
        <p className="text-slate-500 text-sm mt-1">Lista completa de pacientes e detalhes de adesão.</p>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📂</div>
          <h3 className="text-base font-bold text-slate-900">Nenhum registo encontrado</h3>
          <p className="text-xs text-slate-500">Não existem pacientes cadastradas no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(p => (
            <div key={p.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                    p.status === 'red' ? 'bg-rose-100 text-rose-800' :
                    p.status === 'yellow' ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>{p.adherence}% Adesão</span>
                  <span className="text-xs text-slate-400">Dia {p.cycleDay} do ciclo</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">{p.full_name || p.email}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{p.email}</p>
                <p className="text-xs text-slate-600 mt-3 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {p.planTitle}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                Dificuldade: <strong className="text-slate-700">{p.topReason}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MealPlansView({ plans, onCreatePlan }: { plans: MealPlan[]; onCreatePlan: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Planos Alimentares 📋</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão e histórico de planos criados para as suas pacientes.</p>
        </div>
        <button
          onClick={onCreatePlan}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs self-start md:self-auto"
        >
          + Criar Novo Plano
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📂</div>
          <h3 className="text-base font-bold text-slate-900">Nenhum plano cadastrado</h3>
          <p className="text-xs text-slate-500">Clique em &ldquo;+ Criar Novo Plano&rdquo; acima.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-lg">{plan.title}</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                    {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Paciente: <span className="font-semibold text-slate-800">{plan.cycles?.profiles?.full_name ?? plan.profiles?.full_name ?? '—'}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">{plan.start_date} até {plan.end_date}</p>
              </div>
              {Array.isArray(plan.meals_json) && plan.meals_json.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Refeições</span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {plan.meals_json.map((m, i) => (
                      <div key={i} className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-100 flex justify-between gap-2">
                        <span className="font-semibold text-slate-700 shrink-0">{m.time} — {m.title}</span>
                        <span className="text-slate-400 truncate">{m.description}</span>
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
  );
}

function ReportsView() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Relatórios de Adesão 📈</h1>
        <p className="text-slate-500 text-sm mt-1">Relatórios analíticos de adesão e progresso das pacientes.</p>
      </div>
      <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
        <div className="text-4xl">📊</div>
        <h3 className="text-base font-bold text-slate-900">Em Desenvolvimento</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">A funcionalidade de relatórios detalhados estará disponível em breve.</p>
      </div>
    </div>
  );
}

function SettingsView({ user, nutriName }: { user: User | null; nutriName: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Configurações ⚙️</h1>
        <p className="text-slate-500 text-sm mt-1">Ajustes da conta e preferências profissionais.</p>
      </div>
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs max-w-xl">
        <h2 className="text-base font-bold text-slate-900 mb-4">Perfil Profissional</h2>
        <dl className="space-y-2 text-xs text-slate-600">
          <div className="flex gap-2"><dt className="font-bold text-slate-800 w-28">Nome:</dt><dd>{nutriName}</dd></div>
          <div className="flex gap-2"><dt className="font-bold text-slate-800 w-28">Email:</dt><dd>{user?.email ?? '—'}</dd></div>
          <div className="flex gap-2"><dt className="font-bold text-slate-800 w-28">ID:</dt><dd className="truncate">{user?.id ?? '—'}</dd></div>
          <div className="flex gap-2"><dt className="font-bold text-slate-800 w-28">Papel:</dt><dd>Nutricionista</dd></div>
        </dl>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL CRIAR PLANO
// ============================================================================

type PlanFormData = {
  patientId: string;
  title: string;
  startDate: string;
  endDate: string;
  meals: MealItem[];
};

function CreatePlanModal({
  isOpen, onClose, patients, onSubmit, submitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientProfile[];
  onSubmit: (data: PlanFormData) => Promise<void>;
  submitting: boolean;
}) {
  const [patientId,  setPatientId]  = useState('');
  const [title,      setTitle]      = useState('Plano de 30 Dias');
  const [startDate,  setStartDate]  = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate,    setEndDate]    = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [meals, setMeals] = useState<MealItem[]>(DEFAULT_MEALS);

  const changeMeal = (i: number, field: keyof MealItem, val: string) => {
    setMeals(prev => { const a = [...prev]; a[i] = { ...a[i], [field]: val }; return a; });
  };
  const addMeal = () => setMeals(prev => [
    ...prev, { id: `m_${Date.now()}`, time: '10:00', title: 'Novo Lanche', description: 'Descrição do alimento' },
  ]);
  const removeMeal = (i: number) => setMeals(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    await onSubmit({ patientId, title, startDate, endDate, meals });
    // Reset após sucesso (o modal fecha no handler externo)
    setPatientId('');
    setTitle('Plano de 30 Dias');
    setMeals(DEFAULT_MEALS);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-teal-900">Criar Novo Plano Alimentar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2" aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Paciente */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Paciente *</label>
            <select
              required
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">— Selecione uma paciente —</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
            {patientId && (
              <p className="text-[10px] text-slate-400 mt-1 font-mono">patient_id: {patientId}</p>
            )}
          </div>

          {/* Título e datas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título *</label>
              <input
                type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Início *</label>
              <input
                type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Término *</label>
              <input
                type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Refeições */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Refeições</span>
              <button type="button" onClick={addMeal}
                className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold px-3 py-1.5 rounded-lg transition">
                + Adicionar
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {meals.map((meal, i) => (
                <div key={meal.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="time" required value={meal.time} onChange={e => changeMeal(i, 'time', e.target.value)}
                      className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    <input type="text" required value={meal.title} onChange={e => changeMeal(i, 'title', e.target.value)}
                      placeholder="Nome da Refeição"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    {meals.length > 1 && (
                      <button type="button" onClick={() => removeMeal(i)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-bold px-1" aria-label="Remover">✕</button>
                    )}
                  </div>
                  <textarea required value={meal.description} onChange={e => changeMeal(i, 'description', e.target.value)}
                    placeholder="Descrição dos alimentos" rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !patientId}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? 'A gravar…' : 'Gravar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================

export default function NutriDashboard() {
  const router = useRouter();

  // ── estado da aba activa ──────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const activeView = normalizeView(currentView); // valor canónico usado na renderização

  // ── autenticação / perfil ─────────────────────────────────────────────────
  const [user,       setUser]      = useState<User | null>(null);
  const [nutriName,  setNutriName] = useState('Dra. Juliana');
  const [loading,    setLoading]   = useState(true);
  const [authError,  setAuthError] = useState<string | null>(null);

  // ── dados ─────────────────────────────────────────────────────────────────
  const [patients,    setPatients]    = useState<PatientProfile[]>([]);
  const [recentPlans, setRecentPlans] = useState<MealPlan[]>([]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [toasts,      setToasts]      = useState<Toast[]>([]);

  const addToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    setToasts(prev => [...prev, { id: `t-${Date.now()}-${Math.random()}`, message, kind }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── menu ──────────────────────────────────────────────────────────────────
  const navItems: { label: string; view: ViewType; icon: string }[] = [
    { label: 'Dashboard',        view: 'dashboard',  icon: '📊' },
    { label: 'Pacientes',        view: 'patients',   icon: '👥' },
    { label: 'Planos Alimentares', view: 'meal-plans', icon: '📋' },
    { label: 'Relatórios',       view: 'reports',    icon: '📈' },
    { label: 'Configurações',    view: 'settings',   icon: '⚙️' },
  ];

  const VIEW_TITLES: Record<NormalizedView, string> = {
    dashboard:   'Visão Geral do Consultório',
    patients:    'Gestão de Pacientes',
    'meal-plans':'Planos Alimentares',
    reports:     'Relatórios Clínicos',
    settings:    'Configurações do Consultório',
  };

  // ── carga de dados ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive && loading) {
        setLoading(false);
        setAuthError('Tempo limite de carregamento excedido. Verifique a ligação ao Supabase.');
      }
    }, 5000);

    async function load() {
      try {
        const { data: { user: u }, error: ue } = await supabase.auth.getUser();
        if (ue || !u) { setAuthError('Sessão expirada ou utilizador não autenticado.'); return; }
        if (alive) setUser(u);

        const { data: profile, error: pe } = await supabase
          .from('profiles').select('role, full_name').eq('id', u.id).single();
        if (pe || !profile) { setAuthError('Perfil profissional não encontrado.'); return; }
        if (profile.role === 'patient') { router.push('/dashboard/patient'); return; }
        if (profile.role !== 'nutritionist') { setAuthError(`Acesso negado (role: ${profile.role}).`); return; }
        if (alive) setNutriName(formatDoctorName(profile.full_name, u.email));

        // Pacientes
        const { data: pData } = await supabase.from('profiles').select('id, full_name').eq('role', 'patient');
        if (alive) {
          if (pData && pData.length > 0) {
            setPatients(pData.map((p, i) => {
              const fb = DEMO_PATIENTS[i % DEMO_PATIENTS.length];
              return { ...p, email: fb.email, adherence: fb.adherence, status: fb.status, cycleDay: fb.cycleDay, topReason: fb.topReason, planTitle: fb.planTitle };
            }));
          } else {
            setPatients(DEMO_PATIENTS);
          }
        }

        // Planos — tenta via nutritionist_id directo (mais robusto sem join)
        const { data: plans, error: plansErr } = await supabase
          .from('meal_plans')
          .select('*, profiles:patient_id(full_name)')
          .eq('nutritionist_id', u.id)
          .order('created_at', { ascending: false });

        if (alive) {
          if (!plansErr && plans) setRecentPlans(plans as MealPlan[]);
        }
      } catch (err) {
        if (alive) setAuthError(`Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (alive) { setLoading(false); clearTimeout(timer); }
      }
    }

    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [router]);

  // ── gravar plano ──────────────────────────────────────────────────────────
  const handleCreatePlan = async (data: PlanFormData) => {
    if (!user) { addToast('Utilizador não autenticado.', 'error'); return; }

    setSubmitting(true);
    try {
      // Payload exactamente com os campos da tabela (sem notes — coluna inexistente)
      const payload = {
        patient_id:      data.patientId,
        nutritionist_id: user.id,
        title:           data.title,
        start_date:      data.startDate,
        end_date:        data.endDate,
        meals_json:      data.meals,
      };

      console.log('📤 [createPlan] payload:', { ...payload, meals_json: `${payload.meals_json.length} refeições` });

      const { data: inserted, error } = await supabase.from('meal_plans').insert(payload).select();

      if (error) {
        // Tratamento detalhado de erros comuns
        let msg: string;
        switch (error.code) {
          case '23503':
            msg = `Chave estrangeira inválida: a paciente (ID ${data.patientId}) não existe em 'profiles' ou não tem role='patient'. Verifique se o cadastro está correcto.`;
            break;
          case '23505':
            msg = 'Já existe um plano com este título para esta paciente neste período.';
            break;
          case '42501':
            msg = 'Permissão negada pela política RLS. Confirme que está autenticado como nutricionista.';
            break;
          case '42703':
            msg = `Coluna inexistente no schema: ${error.message}`;
            break;
          default:
            msg = `Erro ao gravar plano (código ${error.code ?? 'N/A'}): ${error.message}`;
        }
        console.error('❌ [createPlan]', error);
        addToast(msg, 'error');
        return;
      }

      console.log('✅ [createPlan] sucesso:', inserted);
      addToast('✨ Plano alimentar gravado com sucesso!', 'success');
      setModalOpen(false);

      // Recarregar lista de planos
      const { data: refreshed } = await supabase
        .from('meal_plans')
        .select('*, profiles:patient_id(full_name)')
        .eq('nutritionist_id', user.id)
        .order('created_at', { ascending: false });
      if (refreshed) setRecentPlans(refreshed as MealPlan[]);

    } catch (err) {
      const msg = `Excepção inesperada: ${err instanceof Error ? err.message : String(err)}`;
      console.error('❌ [createPlan] catch:', err);
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ── estados de carregamento / erro ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center text-slate-500 font-medium">
        Carregando painel profissional…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center space-y-4 border border-rose-100">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900">Erro de Acesso</h2>
          <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">{authError}</p>
          <button onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 px-4 rounded-xl transition">
            Sair e voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // ── render principal ──────────────────────────────────────────────────────
  return (
    <>
      {/* Animação de entrada dos toasts — injectada sem styled-jsx */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes nutri-slide-in { from { opacity: 0; transform: translateX(1.5rem); } to { opacity: 1; transform: none; } }
      ` }} />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div className="min-h-screen bg-[#F7F9FA] text-slate-800 flex flex-col md:flex-row font-sans">

        {/* ── Mobile header ── */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥗</span>
            <span className="font-extrabold text-sm text-emerald-950">NutriAdesão</span>
          </div>
          <button onClick={() => setMobileOpen(v => !v)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition" aria-label="Menu">
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex md:hidden">
            <div className="w-72 bg-white h-full shadow-2xl flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🥗</span>
                    <span className="font-extrabold text-sm text-emerald-950">NutriAdesão</span>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="text-slate-400 font-bold text-lg p-1">✕</button>
                </div>
                <nav className="py-6 space-y-1.5">
                  {navItems.map(item => {
                    const active = normalizeView(item.view) === activeView;
                    return (
                      <button key={item.view}
                        onClick={() => { setCurrentView(item.view); setMobileOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                          active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}>
                        <span>{item.icon}</span>{item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 truncate mb-0.5">{nutriName}</p>
                <p className="text-[11px] text-slate-500 truncate mb-3">{user?.email}</p>
                <button onClick={handleLogout}
                  className="w-full bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                  🚪 Sair
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col justify-between shrink-0 min-h-screen sticky top-0 z-30 shadow-sm">
          <div>
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <span className="text-3xl">🥗</span>
              <div>
                <span className="font-extrabold text-base text-emerald-950 tracking-tight block">NutriAdesão</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Painel Clínico</span>
              </div>
            </div>
            <nav className="p-4 space-y-1.5">
              {navItems.map(item => {
                const active = normalizeView(item.view) === activeView;
                return (
                  <button key={item.view}
                    onClick={() => setCurrentView(item.view)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                      active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}>
                    <span>{item.icon}</span>{item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="p-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-800 truncate">{nutriName}</p>
            <p className="text-[11px] text-slate-500 truncate mb-3">{user?.email}</p>
            <button onClick={handleLogout}
              className="w-full bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-2">
              🚪 Sair da conta
            </button>
          </div>
        </aside>

        {/* ── Conteúdo principal ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20 shadow-sm">
            <h2 className="text-base font-bold text-slate-800">{VIEW_TITLES[activeView]}</h2>
            {(activeView === 'dashboard' || activeView === 'meal-plans') && (
              <button onClick={() => setModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2">
                + Novo Plano Alimentar
              </button>
            )}
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            {/* ── SWITCH DE ABAS ─────────────────────────────────────────── */}
            {activeView === 'dashboard' && (
              <DashboardView
                nutriName={nutriName}
                patients={patients}
                recentPlans={recentPlans}
                onNavigate={setCurrentView}
                onCreatePlan={() => setModalOpen(true)}
              />
            )}

            {activeView === 'patients' && (
              <PatientsView patients={patients} />
            )}

            {activeView === 'meal-plans' && (
              <MealPlansView plans={recentPlans} onCreatePlan={() => setModalOpen(true)} />
            )}

            {activeView === 'reports' && <ReportsView />}

            {activeView === 'settings' && (
              <SettingsView user={user} nutriName={nutriName} />
            )}
          </main>
        </div>
      </div>

      {/* ── Modal ── */}
      <CreatePlanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        patients={patients}
        onSubmit={handleCreatePlan}
        submitting={submitting}
      />
    </>
  );
}
