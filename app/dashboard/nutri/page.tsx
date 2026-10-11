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
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  objective?: string | null;
  notes?: string | null;
  nutritionist_id?: string | null;
  adherence?: number;
  status?: 'green' | 'yellow' | 'red';
  cycleDay?: number;
  topReason?: string;
  planTitle?: string;
  source?: 'db' | 'demo';
};

type MealItem = {
  id: string;
  time: string;
  title: string;
  description: string;
};

// Reflecte exactamente o schema: patient_id, nutritionist_id, title,
// start_date, end_date, meals_json. Sem cycle_id, sem notes.
type MealPlan = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  title: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  meals_json: MealItem[];
  // Suporte para both patients e profiles tables
  profiles?: { full_name?: string | null };
  patients?: { full_name?: string | null };
};

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

type PatientFormData = {
  full_name: string;
  email: string;
  phone: string;
  objective: string;
  notes: string;
};

type PlanFormData = {
  patientId: string;
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  meals: MealItem[];
};

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function normalizeView(v: ViewType): NormalizedView {
  const map: Record<ViewType, NormalizedView> = {
    dashboard: 'dashboard', inicio: 'dashboard',
    patients: 'patients', pacientes: 'patients',
    'meal-plans': 'meal-plans', planos: 'meal-plans',
    reports: 'reports', relatorios: 'reports',
    settings: 'settings', configuracoes: 'settings',
  };
  return map[v] ?? 'dashboard';
}

function formatDoctorName(fullName?: string | null, email?: string | null): string {
  if (fullName?.trim()) {
    return `Dra. ${fullName.replace(/^(dra?\.?\s*)/i, '').trim()}`;
  }
  if (email) {
    const handle = email.split('@')[0]
      .replace(/[0-9_.-]/g, ' ').trim()
      .split(' ').filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    if (handle) return `Dra. ${handle}`;
  }
  return 'Dra. Juliana';
}

// Helper para obter nome da paciente de qualquer estrutura (patients ou profiles)
function getPatientName(plan: MealPlan): string {
  return plan.patients?.full_name || plan.profiles?.full_name || '—';
}

const DEFAULT_MEALS: MealItem[] = [
  { id: 'm1', time: '08:00', title: 'Café da Manhã',   description: '2 ovos mexidos + 1 fatia pão integral + Café com leite desnatado' },
  { id: 'm2', time: '12:30', title: 'Almoço',          description: '150g frango grelhado + 4 col. arroz integral + Salada + Azeite' },
  { id: 'm3', time: '16:00', title: 'Lanche da Tarde', description: '1 iogurte natural + 1 fruta + 1 col. aveia' },
  { id: 'm4', time: '20:00', title: 'Jantar',          description: '1 filé peixe assado + Purê mandioquinha + Brócolis no vapor' },
];

const DEMO_PATIENTS: PatientProfile[] = [
  { id: '11111111-1111-1111-1111-111111111111', full_name: 'Mariana Silva',   email: 'mariana.silva@exemplo.com',  adherence: 88, status: 'green',  cycleDay: 8,  topReason: 'Não teve tempo (2x)',       planTitle: 'Plano 30 Dias – Emagrecimento', source: 'demo' },
  { id: '22222222-2222-2222-2222-222222222222', full_name: 'Carla Souza',     email: 'carla.souza@exemplo.com',    adherence: 72, status: 'yellow', cycleDay: 14, topReason: 'Fora de casa (4x)',         planTitle: 'Plano 30 Dias – Hipertrofia',   source: 'demo' },
  { id: '33333333-3333-3333-3333-333333333333', full_name: 'Juliana Mendes', email: 'juliana.mendes@exemplo.com', adherence: 52, status: 'red',    cycleDay: 22, topReason: 'Esqueci (5x)',               planTitle: 'Plano 30 Dias – Manutenção',    source: 'demo' },
];

// ============================================================================
// TOAST
// ============================================================================

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 6000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const cls: Record<Toast['kind'], string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-rose-50    border-rose-200    text-rose-800',
    warning: 'bg-amber-50   border-amber-200   text-amber-800',
    info:    'bg-blue-50    border-blue-200    text-blue-800',
  };
  const icon: Record<Toast['kind'], string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg max-w-sm ${cls[toast.kind]}`}>
      <span className="text-base font-bold mt-0.5 shrink-0">{icon[toast.kind]}</span>
      <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 font-bold text-xs" aria-label="Fechar">✕</button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
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
// VIEW: DASHBOARD
// ============================================================================

function DashboardView({ nutriName, patients, recentPlans, onNavigate, onCreatePlan }: {
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
          <p className="text-slate-500 text-sm mt-1">Acompanhe a evolução das suas pacientes e identifique quem precisa de atenção.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 px-4 py-2 rounded-2xl border border-emerald-100 text-xs font-bold self-start md:self-auto">
          <span>🟢 Sistema Ativo</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Pacientes Totais',    value: total,              sub: '↑ Cadastradas',    icon: '👥', color: 'bg-emerald-50' },
          { label: 'Adesão Média',        value: `${avgAdherence}%`, sub: 'Desempenho geral',  icon: '📈', color: 'bg-teal-50'   },
          { label: 'Precisam de Atenção', value: needAttn,           sub: 'Adesão < 60%',      icon: '⚠️', color: 'bg-rose-50',  valueClass: 'text-rose-600' },
          { label: 'Ativas no Ciclo',     value: total,              sub: 'Ciclo de 30 Dias',  icon: '🔄', color: 'bg-teal-50'   },
        ].map(c => (
          <div key={c.label} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">{c.label}</span>
              <span className={`text-3xl font-extrabold mt-1 block ${c.valueClass ?? 'text-slate-900'}`}>{c.value}</span>
              <span className="text-xs text-emerald-600 font-semibold mt-1 inline-block">{c.sub}</span>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${c.color} flex items-center justify-center text-xl shrink-0`}>{c.icon}</div>
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
              <p className="text-xs text-amber-700">Quedas na consistência ou dificuldades recorrentes.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attnList.map(p => (
              <div key={`attn-${p.id}`} className="bg-white p-5 rounded-2xl border border-amber-200/60 shadow-2xs flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">{p.full_name ?? p.email}</h3>
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">{p.adherence}%</span>
                  </div>
                  <p className="text-xs text-slate-500">Dificuldade: <span className="font-medium text-rose-700">{p.topReason}</span></p>
                </div>
                <button onClick={() => onNavigate('patients')}
                  className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs py-2 rounded-xl transition">
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
            Nenhum plano cadastrado ainda.
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
                <p className="text-xs text-slate-500">Paciente: <span className="font-semibold text-slate-800">{getPatientName(plan)}</span></p>
                <p className="text-xs text-slate-400 mt-1">{plan.start_date} até {plan.end_date}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: PACIENTES
// ============================================================================

function PatientsView({ patients, onNewPatient, onEditPatient }: {
  patients: PatientProfile[];
  onNewPatient: () => void;
  onEditPatient: (patient: PatientProfile) => void;
}) {
  const statusBadge = (p: PatientProfile) => {
    const base = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full';
    if (p.status === 'red')    return `${base} bg-rose-100  text-rose-800`;
    if (p.status === 'yellow') return `${base} bg-amber-100 text-amber-800`;
    return `${base} bg-emerald-100 text-emerald-800`;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Pacientes Cadastradas 👥</h1>
          <p className="text-slate-500 text-sm mt-1">Lista completa com detalhes de adesão e objectivos.</p>
        </div>
        <button
          onClick={onNewPatient}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 self-start md:self-auto active:scale-[.98]"
        >
          <span className="text-base leading-none">＋</span> Nova Paciente
        </button>
      </div>

      {/* Listagem */}
      {patients.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <h3 className="text-base font-bold text-slate-900">Sem pacientes cadastradas</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">Clique em &ldquo;Nova Paciente&rdquo; para adicionar o primeiro registo.</p>
          <button onClick={onNewPatient}
            className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2">
            <span>＋</span> Nova Paciente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(p => (
            <div key={p.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              {/* Cabeçalho do card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700 shrink-0">
                    {(p.full_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{p.full_name ?? '—'}</h3>
                    <p className="text-xs text-slate-500 truncate">{p.email ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.adherence != null && <span className={statusBadge(p)}>{p.adherence}%</span>}
                  <button
                    onClick={() => onEditPatient(p)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition flex items-center justify-center text-sm"
                    title="Editar paciente"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              {/* Detalhes */}
              <div className="space-y-1.5 text-xs text-slate-600">
                {p.phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">📞</span>
                    <span>{p.phone}</span>
                  </div>
                )}
                {p.objective && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">🎯</span>
                    <span className="line-clamp-2">{p.objective}</span>
                  </div>
                )}
                {p.planTitle && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-400 mt-0.5">📋</span>
                    <span className="text-slate-600 font-medium">{p.planTitle}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                {p.cycleDay != null && <span>Dia {p.cycleDay} do ciclo</span>}
                {p.topReason && <span className="truncate max-w-[120px]">{p.topReason}</span>}
                {p.source === 'demo' && (
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md font-medium">demo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIEW: PLANOS ALIMENTARES
// ============================================================================

function MealPlansView({
  plans,
  patients,
  selectedPatientId,
  onSelectPatient,
  onCreatePlan
}: {
  plans: MealPlan[];
  patients: PatientProfile[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  onCreatePlan: () => void;
}) {
  const filteredPlans = selectedPatientId
    ? plans.filter(p => p.patient_id === selectedPatientId)
    : plans;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Planos Alimentares 📋</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão e histórico de planos criados para as suas pacientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedPatientId}
            onChange={e => onSelectPatient(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as Pacientes</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
            ))}
          </select>
          <button onClick={onCreatePlan}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs">
            + Criar Novo Plano
          </button>
        </div>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📂</div>
          <h3 className="text-base font-bold text-slate-900">Nenhum plano encontrado</h3>
          <p className="text-xs text-slate-500">Não existem planos para o filtro selecionado ou clique em &ldquo;+ Criar Novo Plano&rdquo;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlans.map(plan => (
            <div key={plan.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-lg">{plan.title}</h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 border border-teal-200">
                    {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Paciente: <span className="font-semibold text-slate-800">{getPatientName(plan)}</span></p>
                <p className="text-xs text-slate-400 mt-1">{plan.start_date} até {plan.end_date}</p>
                {plan.notes && (
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <strong>Notas:</strong> {plan.notes}
                  </p>
                )}
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

// ============================================================================
// VIEW: RELATÓRIOS
// ============================================================================

function ReportsView() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Relatórios de Adesão 📈</h1>
        <p className="text-slate-500 text-sm mt-1">Relatórios analíticos de adesão e progresso.</p>
      </div>
      <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
        <div className="text-4xl">📊</div>
        <h3 className="text-base font-bold text-slate-900">Em Desenvolvimento</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">Esta funcionalidade estará disponível em breve.</p>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW: CONFIGURAÇÕES
// ============================================================================

function SettingsView({ user, nutriName, onUpdateProfile, submitting }: {
  user: User | null;
  nutriName: string;
  onUpdateProfile: (fullName: string, email: string) => Promise<void>;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState(() => nutriName.replace(/^dra?\.?\s*/i, ''));
  const [email, setEmail] = useState(() => user?.email || '');

  useEffect(() => {
    if (nutriName) {
      setFullName(nutriName.replace(/^dra?\.?\s*/i, ''));
    }
    if (user?.email) {
      setEmail(user.email);
    }
  }, [nutriName, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile(fullName, email);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Configurações ⚙️</h1>
        <p className="text-slate-500 text-sm mt-1">Ajustes da conta e preferências profissionais.</p>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-2xs max-w-xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">Perfil Profissional</h2>
          <p className="text-xs text-slate-500 mt-0.5">Actualize o seu nome completo e e-mail de contacto. As alterações refletem-se imediatamente no painel.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ex: Juliana Mendes"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Contacto *</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="juliana@exemplo.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> A guardar…</>
              ) : 'Guardar Alterações'}
            </button>
          </div>
        </form>

        <div className="border-t border-slate-100 pt-4 space-y-1 text-xs text-slate-400">
          <p><strong>ID da Conta:</strong> <span className="font-mono text-[10px]">{user?.id ?? '—'}</span></p>
          <p><strong>Papel:</strong> Nutricionista</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: EDITAR PACIENTE
// ============================================================================

function EditPatientModal({ isOpen, onClose, patient, onSubmit, submitting }: {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientProfile | null;
  onSubmit: (data: PatientFormData) => Promise<void>;
  submitting: boolean;
}) {
  const empty: PatientFormData = { full_name: '', email: '', phone: '', objective: '', notes: '' };
  const [form, setForm] = useState<PatientFormData>(empty);

  // Inicializar formulário com dados da paciente quando abrir o modal
  useEffect(() => {
    if (patient) {
      setForm({
        full_name: patient.full_name || '',
        email: patient.email || '',
        phone: patient.phone || '',
        objective: patient.objective || '',
        notes: patient.notes || '',
      });
    } else {
      setForm(empty);
    }
  }, [patient]);

  const set = (field: keyof PatientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Editar Paciente</h2>
            <p className="text-xs text-slate-500 mt-0.5">Atualize os dados da paciente {patient.full_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2" aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <input
              type="text" required value={form.full_name} onChange={set('full_name')}
              placeholder="Ex: Ana Paula Ferreira"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email e Telefone em grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email" value={form.email} onChange={set('email')}
                placeholder="ana@exemplo.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                type="tel" value={form.phone} onChange={set('phone')}
                placeholder="(11) 99999-9999"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Objetivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Objetivo Principal</label>
            <select
              value={form.objective} onChange={set('objective')}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">— Selecione o objetivo —</option>
              <option value="Emagrecimento">Emagrecimento</option>
              <option value="Hipertrofia">Hipertrofia / Ganho de massa</option>
              <option value="Manutenção">Manutenção do peso</option>
              <option value="Reeducação alimentar">Reeducação alimentar</option>
              <option value="Saúde e qualidade de vida">Saúde e qualidade de vida</option>
              <option value="Controlo glicémico">Controlo glicémico</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações / Notas Clínicas</label>
            <textarea
              value={form.notes} onChange={set('notes')}
              placeholder="Alergias, restrições alimentares, histórico relevante…"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !form.full_name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> A guardar…</>
              ) : 'Atualizar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: NOVA PACIENTE
// ============================================================================

function NewPatientModal({ isOpen, onClose, onSubmit, submitting }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PatientFormData) => Promise<void>;
  submitting: boolean;
}) {
  const empty: PatientFormData = { full_name: '', email: '', phone: '', objective: '', notes: '' };
  const [form, setForm] = useState<PatientFormData>(empty);

  const set = (field: keyof PatientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
    setForm(empty);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 my-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Nova Paciente</h2>
            <p className="text-xs text-slate-500 mt-0.5">Preencha os dados da nova paciente</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2" aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
            <input
              type="text" required value={form.full_name} onChange={set('full_name')}
              placeholder="Ex: Ana Paula Ferreira"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email e Telefone em grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email" value={form.email} onChange={set('email')}
                placeholder="ana@exemplo.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                type="tel" value={form.phone} onChange={set('phone')}
                placeholder="(11) 99999-9999"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Objetivo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Objetivo Principal</label>
            <select
              value={form.objective} onChange={set('objective')}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">— Selecione o objetivo —</option>
              <option value="Emagrecimento">Emagrecimento</option>
              <option value="Hipertrofia">Hipertrofia / Ganho de massa</option>
              <option value="Manutenção">Manutenção do peso</option>
              <option value="Reeducação alimentar">Reeducação alimentar</option>
              <option value="Saúde e qualidade de vida">Saúde e qualidade de vida</option>
              <option value="Controlo glicémico">Controlo glicémico</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações / Notas Clínicas</label>
            <textarea
              value={form.notes} onChange={set('notes')}
              placeholder="Alergias, restrições alimentares, histórico relevante…"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !form.full_name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> A guardar…</>
              ) : 'Cadastrar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: CRIAR PLANO ALIMENTAR
// ============================================================================

function CreatePlanModal({ isOpen, onClose, patients, onSubmit, submitting }: {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientProfile[];
  onSubmit: (data: PlanFormData) => Promise<void>;
  submitting: boolean;
}) {
  const [patientId, setPatientId] = useState('');
  const [title,     setTitle]     = useState('Plano de 30 Dias');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate,   setEndDate]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [notes,     setNotes]     = useState('');
  const [meals, setMeals] = useState<MealItem[]>(DEFAULT_MEALS);

  const changeMeal = (i: number, f: keyof MealItem, v: string) =>
    setMeals(prev => { const a = [...prev]; a[i] = { ...a[i], [f]: v }; return a; });
  const addMeal = () => setMeals(prev => [...prev, {
    id: `m_${Date.now()}`, time: '10:00', title: 'Novo Lanche', description: 'Descrição do alimento',
  }]);
  const removeMeal = (i: number) => setMeals(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    await onSubmit({ patientId, title, startDate, endDate, notes, meals });
    setPatientId(''); setTitle('Plano de 30 Dias'); setNotes(''); setMeals(DEFAULT_MEALS);
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
            <select required value={patientId} onChange={e => setPatientId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option value="">— Selecione uma paciente —</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
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
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Início *</label>
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Término *</label>
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          {/* Refeições */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Refeições do Plano</span>
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
                        className="text-xs text-rose-500 hover:text-rose-700 font-bold px-1 shrink-0" aria-label="Remover">✕</button>
                    )}
                  </div>
                  <textarea required value={meal.description} onChange={e => changeMeal(i, 'description', e.target.value)}
                    placeholder="Descrição dos alimentos" rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Observações / Notas do Plano */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações / Orientações do Plano</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Recomendações gerais, hidratação, suplementação…"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !patientId}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> A gravar…</>
              ) : 'Gravar Plano'}
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

  // ── aba activa ─────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const activeView = normalizeView(currentView);

  // ── autenticação ───────────────────────────────────────────────────────────
  const [user,      setUser]      = useState<User | null>(null);
  const [nutriName, setNutriName] = useState('Dra. Juliana');
  const [loading,   setLoading]   = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── dados ──────────────────────────────────────────────────────────────────
  const [patients,              setPatients]              = useState<PatientProfile[]>([]);
  const [recentPlans,           setRecentPlans]           = useState<MealPlan[]>([]);
  const [selectedPlanPatientId, setSelectedPlanPatientId] = useState('');

  // ── fetchMealPlans helper ──────────────────────────────────────────────────
  const fetchMealPlans = useCallback(async () => {
    try {
      console.log('📋 [fetchMealPlans] A buscar todos os planos alimentares (sem filtros restritivos)...');
      
      // Primeiro, tentar buscar com JOIN na tabela patients (correta)
      const { data: plans, error: plansErr } = await supabase
        .from('meal_plans')
        .select(`
          id, 
          title, 
          created_at, 
          start_date, 
          end_date, 
          notes, 
          meals_json, 
          patient_id, 
          nutritionist_id,
          patients:patient_id(full_name)
        `)
        .order('created_at', { ascending: false });

      // CONSOLE LOG SOLICITADO para inspecionar a resposta
      console.log('Planos buscados:', plans, plansErr);

      if (plansErr) {
        console.error('❌ [fetchMealPlans] Erro ao buscar meal_plans com JOIN patients:', plansErr);
        
        // Fallback: tentar com JOIN na tabela profiles (schema antigo)
        console.log('🔄 [fetchMealPlans] Tentando fallback com tabela profiles...');
        const { data: plansProfiles, error: profilesErr } = await supabase
          .from('meal_plans')
          .select(`
            id, 
            title, 
            created_at, 
            start_date, 
            end_date, 
            notes, 
            meals_json, 
            patient_id, 
            nutritionist_id,
            profiles:patient_id(full_name)
          `)
          .order('created_at', { ascending: false });

        if (profilesErr) {
          console.error('❌ [fetchMealPlans] Erro também com profiles, buscando sem JOIN:', profilesErr);
          // Último fallback: buscar sem JOIN
          const { data: basicPlans } = await supabase
            .from('meal_plans')
            .select('id, title, created_at, start_date, end_date, notes, meals_json, patient_id, nutritionist_id')
            .order('created_at', { ascending: false });
          
          if (basicPlans) {
            setRecentPlans(basicPlans as unknown as MealPlan[]);
          }
        } else if (plansProfiles) {
          console.log(`✅ [fetchMealPlans] Encontrados ${plansProfiles.length} planos via profiles.`);
          setRecentPlans(plansProfiles as unknown as MealPlan[]);
        }
      } else if (plans) {
        console.log(`✅ [fetchMealPlans] Encontrados ${plans.length} planos via patients.`);
        setRecentPlans(plans as unknown as MealPlan[]);
      }
    } catch (err) {
      console.error('❌ [fetchMealPlans] Exceção:', err);
    }
  }, []);

  // ── fetchPatients helper ───────────────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    if (!user) return;
    
    try {
      let patientRows: PatientProfile[] = [];
      const { data: pts, error: ptsErr } = await supabase
        .from('patients')
        .select('id, full_name, email, phone, objective, notes, nutritionist_id')
        .eq('nutritionist_id', user.id)
        .order('created_at', { ascending: false });

      if (!ptsErr && pts && pts.length > 0) {
        patientRows = pts.map((p, i) => ({
          ...p,
          adherence: DEMO_PATIENTS[i % DEMO_PATIENTS.length].adherence,
          status:    DEMO_PATIENTS[i % DEMO_PATIENTS.length].status,
          cycleDay:  DEMO_PATIENTS[i % DEMO_PATIENTS.length].cycleDay,
          topReason: DEMO_PATIENTS[i % DEMO_PATIENTS.length].topReason,
          planTitle: DEMO_PATIENTS[i % DEMO_PATIENTS.length].planTitle,
          source:    'db' as const,
        }));
      } else {
        // Fallback: tabela profiles (schema antigo)
        const { data: pData } = await supabase
          .from('profiles').select('id, full_name').eq('role', 'patient');
        if (pData && pData.length > 0) {
          patientRows = pData.map((p, i) => ({
            ...p,
            email:     DEMO_PATIENTS[i % DEMO_PATIENTS.length].email,
            adherence: DEMO_PATIENTS[i % DEMO_PATIENTS.length].adherence,
            status:    DEMO_PATIENTS[i % DEMO_PATIENTS.length].status,
            cycleDay:  DEMO_PATIENTS[i % DEMO_PATIENTS.length].cycleDay,
            topReason: DEMO_PATIENTS[i % DEMO_PATIENTS.length].topReason,
            planTitle: DEMO_PATIENTS[i % DEMO_PATIENTS.length].planTitle,
            source:    'db' as const,
          }));
        } else {
          patientRows = DEMO_PATIENTS;
        }
      }

      setPatients(patientRows);
    } catch (err) {
      console.error('❌ [fetchPatients] Erro:', err);
    }
  }, [user]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [mobileOpen,          setMobileOpen]          = useState(false);
  const [planModalOpen,       setPlanModalOpen]       = useState(false);
  const [patientModalOpen,    setPatientModalOpen]    = useState(false);
  const [editPatientModalOpen, setEditPatientModalOpen] = useState(false);
  const [editingPatient,      setEditingPatient]      = useState<PatientProfile | null>(null);
  const [submitting,          setSubmitting]          = useState(false);
  const [toasts,              setToasts]              = useState<Toast[]>([]);

  const addToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    setToasts(prev => [...prev, { id: `t-${Date.now()}-${Math.random()}`, message, kind }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── nav ────────────────────────────────────────────────────────────────────
  const navItems: { label: string; view: ViewType; icon: string }[] = [
    { label: 'Dashboard',          view: 'dashboard',  icon: '📊' },
    { label: 'Pacientes',          view: 'patients',   icon: '👥' },
    { label: 'Planos Alimentares', view: 'meal-plans', icon: '📋' },
    { label: 'Relatórios',         view: 'reports',    icon: '📈' },
    { label: 'Configurações',      view: 'settings',   icon: '⚙️' },
  ];

  const VIEW_TITLES: Record<NormalizedView, string> = {
    dashboard:    'Visão Geral do Consultório',
    patients:     'Gestão de Pacientes',
    'meal-plans': 'Planos Alimentares',
    reports:      'Relatórios Clínicos',
    settings:     'Configurações do Consultório',
  };

  // ── carga de dados ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive && loading) {
        setLoading(false);
        setAuthError('Tempo limite excedido. Verifique a ligação ao Supabase.');
      }
    }, 5000);

    async function load() {
      try {
        const { data: { user: u }, error: ue } = await supabase.auth.getUser();
        if (ue || !u) { setAuthError('Sessão expirada ou não autenticado.'); return; }
        if (alive) setUser(u);

        const { data: profile, error: pe } = await supabase
          .from('profiles').select('role, full_name').eq('id', u.id).single();
        if (pe || !profile) { setAuthError('Perfil não encontrado.'); return; }
        if (profile.role === 'patient') { router.push('/dashboard/patient'); return; }
        if (profile.role !== 'nutritionist') { setAuthError(`Acesso negado (role: ${profile.role}).`); return; }
        if (alive) setNutriName(formatDoctorName(profile.full_name, u.email));

        // Definir o user primeiro para que fetchPatients possa funcionar
        if (alive) setUser(u);
        
        // Buscar pacientes usando o mesmo código anterior para evitar dependências circulares
        let patientRows: PatientProfile[] = [];
        const { data: pts, error: ptsErr } = await supabase
          .from('patients')
          .select('id, full_name, email, phone, objective, notes, nutritionist_id')
          .eq('nutritionist_id', u.id)
          .order('created_at', { ascending: false });

        if (!ptsErr && pts && pts.length > 0) {
          patientRows = pts.map((p, i) => ({
            ...p,
            adherence: DEMO_PATIENTS[i % DEMO_PATIENTS.length].adherence,
            status:    DEMO_PATIENTS[i % DEMO_PATIENTS.length].status,
            cycleDay:  DEMO_PATIENTS[i % DEMO_PATIENTS.length].cycleDay,
            topReason: DEMO_PATIENTS[i % DEMO_PATIENTS.length].topReason,
            planTitle: DEMO_PATIENTS[i % DEMO_PATIENTS.length].planTitle,
            source:    'db' as const,
          }));
        } else {
          // Fallback: tabela profiles (schema antigo)
          const { data: pData } = await supabase
            .from('profiles').select('id, full_name').eq('role', 'patient');
          if (pData && pData.length > 0) {
            patientRows = pData.map((p, i) => ({
              ...p,
              email:     DEMO_PATIENTS[i % DEMO_PATIENTS.length].email,
              adherence: DEMO_PATIENTS[i % DEMO_PATIENTS.length].adherence,
              status:    DEMO_PATIENTS[i % DEMO_PATIENTS.length].status,
              cycleDay:  DEMO_PATIENTS[i % DEMO_PATIENTS.length].cycleDay,
              topReason: DEMO_PATIENTS[i % DEMO_PATIENTS.length].topReason,
              planTitle: DEMO_PATIENTS[i % DEMO_PATIENTS.length].planTitle,
              source:    'db' as const,
            }));
          } else {
            patientRows = DEMO_PATIENTS;
          }
        }

        if (alive) setPatients(patientRows);

        // Planos alimentares (sem filtros restritivos)
        await fetchMealPlans();
      } catch (err) {
        if (alive) setAuthError(`Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (alive) { setLoading(false); clearTimeout(timer); }
      }
    }

    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [router]);

  // ── gravar paciente ────────────────────────────────────────────────────────
  const handleCreatePatient = async (data: PatientFormData) => {
    if (!user) { addToast('Utilizador não autenticado.', 'error'); return; }

    setSubmitting(true);
    try {
      // Tenta inserir na tabela 'patients' (após migration)
      const payload = {
        nutritionist_id: user.id,
        full_name:       data.full_name.trim(),
        email:           data.email.trim()     || null,
        phone:           data.phone.trim()     || null,
        objective:       data.objective.trim() || null,
        notes:           data.notes.trim()     || null,
      };

      console.log('📤 [createPatient] payload:', payload);

      const { data: inserted, error } = await supabase
        .from('patients')
        .insert(payload)
        .select()
        .single();

      if (error) {
        let msg: string;
        switch (error.code) {
          case '42P01': msg = 'Tabela "patients" não existe. Execute a migration supabase_migration_patients.sql no Supabase SQL Editor.'; break;
          case '42501': msg = 'Permissão negada pela política RLS. Certifique-se de que a migration foi executada.'; break;
          case '23505': msg = 'Já existe uma paciente com este e-mail.'; break;
          default:      msg = `Erro ao cadastrar paciente (${error.code ?? 'N/A'}): ${error.message}`;
        }
        console.error('❌ [createPatient]', error);
        addToast(msg, 'error');
        return;
      }

      console.log('✅ [createPatient] sucesso:', inserted);
      addToast(`✅ Paciente "${data.full_name}" cadastrada com sucesso!`, 'success');
      setPatientModalOpen(false);

      // Actualizar lista localmente sem refetch
      setPatients(prev => [{
        ...inserted,
        adherence: 80, status: 'green' as const, cycleDay: 1,
        topReason: '—', planTitle: '—', source: 'db' as const,
      }, ...prev]);

    } catch (err) {
      addToast(`Excepção: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── editar paciente ────────────────────────────────────────────────────────
  const handleEditPatient = (patient: PatientProfile) => {
    setEditingPatient(patient);
    setEditPatientModalOpen(true);
  };

  const handleUpdatePatient = async (data: PatientFormData) => {
    if (!user || !editingPatient) {
      addToast('Paciente ou usuário não encontrado.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: data.full_name.trim(),
        email: data.email.trim() || null,
        phone: data.phone.trim() || null,
        objective: data.objective.trim() || null,
        notes: data.notes.trim() || null,
      };

      console.log('📤 [updatePatient] payload:', payload, 'for patient ID:', editingPatient.id);

      const { data: updated, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', editingPatient.id)
        .select()
        .single();

      if (error) {
        let msg: string;
        switch (error.code) {
          case '42P01': msg = 'Tabela "patients" não existe. Execute a migration supabase_migration_patients.sql no Supabase SQL Editor.'; break;
          case '42501': msg = 'Permissão negada pela política RLS. Certifique-se de que a migration foi executada.'; break;
          case '23505': msg = 'Já existe uma paciente com este e-mail.'; break;
          default: msg = `Erro ao atualizar paciente (${error.code ?? 'N/A'}): ${error.message}`;
        }
        console.error('❌ [updatePatient]', error);
        addToast(msg, 'error');
        return;
      }

      console.log('✅ [updatePatient] sucesso:', updated);
      addToast(`✅ Paciente "${data.full_name}" atualizada com sucesso!`, 'success');
      setEditPatientModalOpen(false);
      setEditingPatient(null);

      // Recarregar a lista de pacientes
      await fetchPatients();

    } catch (err) {
      addToast(`Excepção: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── gravar plano ───────────────────────────────────────────────────────────
  const handleCreatePlan = async (data: PlanFormData) => {
    if (!user) { addToast('Utilizador não autenticado.', 'error'); return; }

    setSubmitting(true);
    try {
      // 1. Construir payload estrito apenas com colunas válidas e opcionais da tabela meal_plans:
      // patient_id, nutritionist_id, title, start_date, end_date, notes, meals_json
      // Evitando estritamente enviar campos vazios/nulos em colunas antigas como cycle_id ou meal_name.
      const payload: Record<string, any> = {
        patient_id:      data.patientId,
        nutritionist_id: user.id,
        title:           data.title || 'Plano de 30 Dias',
        start_date:      data.startDate,
        end_date:        data.endDate,
        meals_json:      data.meals,
      };

      if (data.notes && data.notes.trim().length > 0) {
        payload.notes = data.notes.trim();
      }

      // 3. console.log detalhado do payload antes do envio para depuração
      console.log('📋 [createPlan] Payload estrito a enviar para meal_plans:', JSON.stringify(payload, null, 2));

      const { data: inserted, error } = await supabase
        .from('meal_plans')
        .insert(payload)
        .select();

      if (error) {
        let msg: string;
        switch (error.code) {
          case '23503': 
            // Erro de chave estrangeira - tentar diagnóstico
            console.error('🔍 [createPlan] Diagnosticando FK error - patient_id:', data.patientId);
            
            // Verificar se o patient existe na tabela patients
            const { data: patientCheck } = await supabase
              .from('patients')
              .select('id, full_name')
              .eq('id', data.patientId)
              .single();
            
            if (patientCheck) {
              msg = `Erro de chave estrangeira: patient_id ${data.patientId} existe na tabela patients mas meal_plans pode estar referenciando profiles. Verifique o schema do banco.`;
            } else {
              msg = `Chave estrangeira inválida: a paciente (ID ${data.patientId}) não existe.`;
            }
            break;
          case '23502': msg = `Coluna obrigatória em falta: ${error.message}.`; break;
          case '23505': msg = 'Já existe um plano com este título para esta paciente neste período.'; break;
          case '42501': msg = 'Permissão negada pela RLS. Confirme que está autenticado como nutricionista.'; break;
          case '42703': msg = `Coluna inexistente: ${error.message}`; break;
          default:      msg = `Erro ao gravar plano (${error.code ?? 'N/A'}): ${error.message}`;
        }
        console.error('❌ [createPlan] Erro Supabase:', error);
        console.error('❌ [createPlan] Payload que falhou:', JSON.stringify(payload, null, 2));
        addToast(msg, 'error');
        return;
      }

      console.log('✅ [createPlan] Sucesso:', inserted);
      console.log('🔄 [createPlan] Iniciando recarregamento da lista de planos...');
      addToast('✨ Plano alimentar gravado com sucesso!', 'success');
      setPlanModalOpen(false);

      // Chamar função de busca/listagem imediatamente para atualizar o estado local da tela
      // Recarregar tanto na montagem do componente quanto quando um novo plano for salvo
      await fetchMealPlans();
      console.log('✅ [createPlan] Recarregamento da lista concluído');

    } catch (err) {
      addToast(`Excepção: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── actualizar perfil ───────────────────────────────────────────────────────
  const handleUpdateProfile = async (newFullName: string, newEmail: string) => {
    if (!user) { addToast('Utilizador não autenticado.', 'error'); return; }

    setSubmitting(true);
    try {
      const trimmedName = newFullName.trim();
      const trimmedEmail = newEmail.trim();

      // 1. Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: trimmedName, email: trimmedEmail })
        .eq('id', user.id);

      if (profileErr) {
        console.warn('⚠️ [updateProfile] Falha ao atualizar email em profiles, tentando apenas full_name:', profileErr);
        const { error: nameErr } = await supabase
          .from('profiles')
          .update({ full_name: trimmedName })
          .eq('id', user.id);
        if (nameErr) {
          addToast(`Erro ao atualizar perfil na base de dados: ${nameErr.message}`, 'error');
          return;
        }
      }

      // 2. Update auth user email if changed
      if (trimmedEmail && trimmedEmail !== user.email) {
        const { error: authErr } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (authErr) {
          addToast(`Perfil atualizado, mas erro ao atualizar e-mail de autenticação: ${authErr.message}`, 'error');
        } else {
          addToast('✨ Perfil e e-mail atualizados com sucesso!', 'success');
        }
      } else {
        addToast('✨ Perfil profissional atualizado com sucesso!', 'success');
      }

      // 3. Update local state immediately so header/greeting updates ("Olá, Dra...")
      const formatted = formatDoctorName(trimmedName, trimmedEmail || user.email);
      setNutriName(formatted);

      const { data: updatedUser } = await supabase.auth.getUser();
      if (updatedUser?.user) {
        setUser(updatedUser.user);
      }

    } catch (err) {
      addToast(`Exceção ao atualizar perfil: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // ── carregamento / erro ────────────────────────────────────────────────────
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

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div className="min-h-screen bg-[#F7F9FA] text-slate-800 flex flex-col md:flex-row font-sans">

        {/* Mobile header */}
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

        {/* Mobile drawer */}
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
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
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

        {/* Desktop sidebar */}
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
                  <button key={item.view} onClick={() => setCurrentView(item.view)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
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

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-slate-200 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20 shadow-sm">
            <h2 className="text-base font-bold text-slate-800">{VIEW_TITLES[activeView]}</h2>
            <div className="flex items-center gap-3">
              {activeView === 'patients' && (
                <button onClick={() => setPatientModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2">
                  ＋ Nova Paciente
                </button>
              )}
              {(activeView === 'dashboard' || activeView === 'meal-plans') && (
                <button onClick={() => setPlanModalOpen(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2">
                  + Novo Plano Alimentar
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            {/* ── SWITCH DE ABAS ── */}
            {activeView === 'dashboard' && (
              <DashboardView
                nutriName={nutriName} patients={patients} recentPlans={recentPlans}
                onNavigate={setCurrentView} onCreatePlan={() => setPlanModalOpen(true)}
              />
            )}
            {activeView === 'patients' && (
              <PatientsView patients={patients} onNewPatient={() => setPatientModalOpen(true)} onEditPatient={handleEditPatient} />
            )}
            {activeView === 'meal-plans' && (
              <MealPlansView
                plans={recentPlans}
                patients={patients}
                selectedPatientId={selectedPlanPatientId}
                onSelectPatient={setSelectedPlanPatientId}
                onCreatePlan={() => setPlanModalOpen(true)}
              />
            )}
            {activeView === 'reports'  && <ReportsView />}
            {activeView === 'settings' && (
              <SettingsView
                user={user}
                nutriName={nutriName}
                onUpdateProfile={handleUpdateProfile}
                submitting={submitting}
              />
            )}
          </main>
        </div>
      </div>

      {/* Modais */}
      <NewPatientModal
        isOpen={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        onSubmit={handleCreatePatient}
        submitting={submitting}
      />
      <EditPatientModal
        isOpen={editPatientModalOpen}
        onClose={() => {
          setEditPatientModalOpen(false);
          setEditingPatient(null);
        }}
        patient={editingPatient}
        onSubmit={handleUpdatePatient}
        submitting={submitting}
      />
      <CreatePlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        patients={patients}
        onSubmit={handleCreatePlan}
        submitting={submitting}
      />
    </>
  );
}
