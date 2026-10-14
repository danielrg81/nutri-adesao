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

type MealPlan = {
  id: string;
  patient_id: string;
  nutritionist_id: string;
  title: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  meals_json: MealItem[];
  profiles?: { full_name?: string | null };
  patients?: { full_name?: string | null };
};

type ViewType =
  | 'dashboard' | 'inicio'
  | 'patients'  | 'pacientes'
  | 'meal-plans'| 'planos'
  | 'consultas' | 'consultas-view'
  | 'receitas'  | 'recipes'
  | 'reports'   | 'relatorios'
  | 'settings'  | 'configuracoes';

type NormalizedView = 'dashboard' | 'patients' | 'meal-plans' | 'consultas' | 'receitas' | 'reports' | 'settings';

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
    consultas: 'consultas', 'consultas-view': 'consultas',
    receitas: 'receitas', recipes: 'receitas',
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

function DashboardView({ nutriName, patients, recentPlans, onNavigate, onCreatePlan, onDeletePlan, onEditPlan }: {
  nutriName: string;
  patients: PatientProfile[];
  recentPlans: MealPlan[];
  onNavigate: (v: ViewType) => void;
  onCreatePlan: () => void;
  onDeletePlan: (planId: string, planTitle: string) => void;
  onEditPlan: (plan: MealPlan) => void;
}) {
  const total        = patients.length;
  const avgAdherence = total > 0 ? Math.round(patients.reduce((s, p) => s + (p.adherence ?? 75), 0) / total) : 0;
  const needAttn     = patients.filter(p => (p.adherence ?? 100) < 60 || p.status === 'red').length;
  const attnList     = patients.filter(p => (p.adherence ?? 100) < 60 || p.status === 'red' || p.status === 'yellow');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Olá, {nutriName} 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Acompanhe a evolução das suas pacientes e identifique quem precisa de atenção.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-xs font-bold self-start md:self-auto">
          <span>🟢 Sistema Ativo</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Pacientes Totais',    value: total,              sub: '↑ Cadastradas',    icon: '👥', color: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Adesão Média',        value: `${avgAdherence}%`, sub: 'Desempenho geral',  icon: '📈', color: 'bg-teal-50 dark:bg-teal-950/40'   },
          { label: 'Precisam de Atenção', value: needAttn,           sub: 'Adesão < 60%',      icon: '⚠️', color: 'bg-rose-50 dark:bg-rose-950/40',  valueClass: 'text-rose-600 dark:text-rose-400' },
          { label: 'Ativas no Ciclo',     value: total,              sub: 'Ciclo de 30 Dias',  icon: '🔄', color: 'bg-teal-50 dark:bg-teal-950/40'   },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">{c.label}</span>
              <span className={`text-3xl font-extrabold mt-1 block ${c.valueClass ?? 'text-slate-900 dark:text-slate-100'}`}>{c.value}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 inline-block">{c.sub}</span>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${c.color} flex items-center justify-center text-xl shrink-0`}>{c.icon}</div>
          </div>
        ))}
      </div>

      {attnList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-3xl p-6 md:p-8 shadow-2xs">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">Pacientes que Requerem Atenção</h2>
              <p className="text-xs text-amber-700 dark:text-amber-400">Quedas na consistência ou dificuldades recorrentes.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attnList.map(p => (
              <div key={`attn-${p.id}`} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200/60 dark:border-slate-800 shadow-2xs flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.full_name ?? p.email}</h3>
                    <span className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">{p.adherence}%</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dificuldade: <span className="font-medium text-rose-700 dark:text-rose-400">{p.topReason}</span></p>
                </div>
                <button onClick={() => onNavigate('patients')}
                  className="w-full bg-amber-100 hover:bg-amber-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-300 font-semibold text-xs py-2 rounded-xl transition">
                  Ver pacientes →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4 border-t border-slate-200/85 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Planos Alimentares Recentes</h2>
          <button onClick={() => onNavigate('meal-plans')} className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline">Ver todos →</button>
        </div>
        {recentPlans.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-sm">
            Nenhum plano cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentPlans.slice(0, 4).map(plan => (
              <div key={plan.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{plan.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                    </span>
                    <button
                      onClick={() => onEditPlan(plan)}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center justify-center text-sm"
                      title="Editar plano"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan.id, plan.title)}
                      className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition flex items-center justify-center text-sm"
                      title="Excluir plano"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Paciente: <span className="font-semibold text-slate-800 dark:text-slate-200">{getPatientName(plan)}</span></p>
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
    if (p.status === 'red')    return `${base} bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300`;
    if (p.status === 'yellow') return `${base} bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300`;
    return `${base} bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Pacientes Cadastradas 👥</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Lista completa com detalhes de adesão e objectivos.</p>
        </div>
        <button
          onClick={onNewPatient}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 self-start md:self-auto active:scale-[.98]"
        >
          <span className="text-base leading-none">＋</span> Nova Paciente
        </button>
      </div>

      {patients.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Sem pacientes cadastradas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Clique em &ldquo;Nova Paciente&rdquo; para adicionar o primeiro registo.</p>
          <button onClick={onNewPatient}
            className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2">
            <span>＋</span> Nova Paciente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-lg font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                    {(p.full_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">{p.full_name ?? '—'}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.email ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.adherence != null && <span className={statusBadge(p)}>{p.adherence}%</span>}
                  <button
                    onClick={() => onEditPatient(p)}
                    className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center justify-center text-sm"
                    title="Editar paciente"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
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
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{p.planTitle}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                {p.cycleDay != null && <span>Dia {p.cycleDay} do ciclo</span>}
                {p.topReason && <span className="truncate max-w-[120px]">{p.topReason}</span>}
                {p.source === 'demo' && (
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-medium">demo</span>
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
  onCreatePlan,
  onDeletePlan,
  onEditPlan
}: {
  plans: MealPlan[];
  patients: PatientProfile[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  onCreatePlan: () => void;
  onDeletePlan: (planId: string, planTitle: string) => void;
  onEditPlan: (plan: MealPlan) => void;
}) {
  const filteredPlans = selectedPatientId
    ? plans.filter(p => p.patient_id === selectedPatientId)
    : plans;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Planos Alimentares 📋</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestão e histórico de planos criados para as suas pacientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedPatientId}
            onChange={e => onSelectPatient(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📂</div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Nenhum plano encontrado</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Não existem planos para o filtro selecionado ou clique em &ldquo;+ Criar Novo Plano&rdquo;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlans.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xs flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{plan.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {Array.isArray(plan.meals_json) ? `${plan.meals_json.length} Refeições` : 'Ativo'}
                    </span>
                    <button
                      onClick={() => onEditPlan(plan)}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center justify-center text-sm"
                      title="Editar plano"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan.id, plan.title)}
                      className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition flex items-center justify-center text-sm"
                      title="Excluir plano"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Paciente: <span className="font-semibold text-slate-800 dark:text-slate-200">{getPatientName(plan)}</span></p>
                <p className="text-xs text-slate-400 mt-1">{plan.start_date} até {plan.end_date}</p>
                {plan.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    <strong>Notas:</strong> {plan.notes}
                  </p>
                )}
              </div>
              {Array.isArray(plan.meals_json) && plan.meals_json.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Refeições</span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {plan.meals_json.map((m, i) => (
                      <div key={i} className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">{m.time} — {m.title}</span>
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
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Relatórios de Adesão 📈</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Relatórios analíticos de adesão e progresso.</p>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
        <div className="text-4xl">📊</div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Em Desenvolvimento</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Esta funcionalidade estará disponível em breve.</p>
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
    if (nutriName) setFullName(nutriName.replace(/^dra?\.?\s*/i, ''));
    if (user?.email) setEmail(user.email);
  }, [nutriName, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile(fullName, email);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Configurações ⚙️</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ajustes da conta e preferências profissionais.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xs max-w-xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Perfil Profissional</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Actualize o seu nome completo e e-mail de contacto.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome Completo *</label>
            <input
              type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">E-mail de Contacto *</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit" disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'A guardar…' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAIS (Editar / Criar Pacientes e Planos)
// ============================================================================

function EditPatientModal({ isOpen, onClose, patient, onSubmit, submitting }: {
  isOpen: boolean; onClose: () => void; patient: PatientProfile | null;
  onSubmit: (data: PatientFormData) => Promise<void>; submitting: boolean;
}) {
  const empty: PatientFormData = { full_name: '', email: '', phone: '', objective: '', notes: '' };
  const [form, setForm] = useState<PatientFormData>(empty);

  useEffect(() => {
    if (patient) {
      setForm({
        full_name: patient.full_name || '', email: patient.email || '',
        phone: patient.phone || '', objective: patient.objective || '', notes: patient.notes || '',
      });
    } else { setForm(empty); }
  }, [patient]);

  const set = (field: keyof PatientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 my-8 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Editar Paciente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2">✕</button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); await onSubmit(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nome Completo *</label>
            <input type="text" required value={form.full_name} onChange={set('full_name')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Telefone / WhatsApp</label>
              <input type="tel" value={form.phone} onChange={set('phone')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Objetivo Principal</label>
            <select value={form.objective} onChange={set('objective')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Selecione —</option>
              <option value="Emagrecimento">Emagrecimento</option>
              <option value="Hipertrofia">Hipertrofia / Ganho de massa</option>
              <option value="Manutenção">Manutenção do peso</option>
              <option value="Reeducação alimentar">Reeducação alimentar</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Cancelar</button>
            <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl">Atualizar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewPatientModal({ isOpen, onClose, onSubmit, submitting }: {
  isOpen: boolean; onClose: () => void; onSubmit: (data: PatientFormData) => Promise<void>; submitting: boolean;
}) {
  const empty: PatientFormData = { full_name: '', email: '', phone: '', objective: '', notes: '' };
  const [form, setForm] = useState<PatientFormData>(empty);
  const set = (field: keyof PatientFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 md:p-8 my-8 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Nova Paciente</h2>
          <button onClick={onClose} className="text-slate-400 font-bold text-lg px-2">✕</button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); await onSubmit(form); setForm(empty); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Nome Completo *</label>
            <input type="text" required value={form.full_name} onChange={set('full_name')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Telefone / WhatsApp</label>
              <input type="tel" value={form.phone} onChange={set('phone')}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Objetivo Principal</label>
            <select value={form.objective} onChange={set('objective')}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800">
              <option value="">— Selecione —</option>
              <option value="Emagrecimento">Emagrecimento</option>
              <option value="Hipertrofia">Hipertrofia</option>
              <option value="Manutenção">Manutenção</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Cancelar</button>
            <button type="submit" disabled={submitting} className="bg-emerald-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl">Cadastrar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePlanModal({ isOpen, onClose, patients, onSubmit, submitting }: {
  isOpen: boolean; onClose: () => void; patients: PatientProfile[];
  onSubmit: (data: PlanFormData) => Promise<void>; submitting: boolean;
}) {
  const [patientId, setPatientId] = useState('');
  const [title, setTitle]     = useState('Plano de 30 Dias');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate]   = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); });
  const [notes, setNotes]     = useState('');
  const [meals, setMeals] = useState<MealItem[]>(DEFAULT_MEALS);

  const changeMeal = (i: number, f: keyof MealItem, v: string) => setMeals(prev => { const a = [...prev]; a[i] = { ...a[i], [f]: v }; return a; });
  const addMeal = () => setMeals(prev => [...prev, { id: `m_${Date.now()}`, time: '10:00', title: 'Novo Lanche', description: 'Descrição' }]);
  const removeMeal = (i: number) => setMeals(prev => prev.filter((_, idx) => idx !== i));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-8 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Criar Novo Plano Alimentar</h2>
          <button onClick={onClose} className="text-slate-400 font-bold text-lg px-2">✕</button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); await onSubmit({ patientId, title, startDate, endDate, notes, meals }); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Paciente *</label>
            <select required value={patientId} onChange={e => setPatientId(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800">
              <option value="">— Selecione uma paciente —</option>
              {patients.map(p => (<option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold mb-1">Título *</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Início *</label>
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Término *</label>
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Cancelar</button>
            <button type="submit" disabled={submitting || !patientId} className="bg-teal-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl">Gravar Plano</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPlanModal({ isOpen, onClose, patients, plan, onSubmit, submitting }: {
  isOpen: boolean; onClose: () => void; patients: PatientProfile[]; plan: MealPlan | null;
  onSubmit: (data: PlanFormData) => Promise<void>; submitting: boolean;
}) {
  const [patientId, setPatientId] = useState('');
  const [title, setTitle]     = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]   = useState('');
  const [notes, setNotes]     = useState('');
  const [meals, setMeals] = useState<MealItem[]>(DEFAULT_MEALS);

  useEffect(() => {
    if (plan) {
      setPatientId(plan.patient_id || '');
      setTitle(plan.title || '');
      setStartDate(plan.start_date || new Date().toISOString().slice(0, 10));
      setEndDate(plan.end_date || new Date().toISOString().slice(0, 10));
      setNotes(plan.notes || '');
      setMeals(Array.isArray(plan.meals_json) && plan.meals_json.length > 0 ? plan.meals_json : DEFAULT_MEALS);
    }
  }, [plan]);

  const changeMeal = (i: number, f: keyof MealItem, v: string) => setMeals(prev => { const a = [...prev]; a[i] = { ...a[i], [f]: v }; return a; });
  const addMeal = () => setMeals(prev => [...prev, { id: `m_${Date.now()}`, time: '10:00', title: 'Novo Lanche', description: 'Descrição' }]);
  const removeMeal = (i: number) => setMeals(prev => prev.filter((_, idx) => idx !== i));

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-8 text-slate-800 dark:text-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Editar Plano Alimentar</h2>
          <button onClick={onClose} className="text-slate-400 font-bold text-lg px-2">✕</button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); await onSubmit({ patientId, title, startDate, endDate, notes, meals }); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Paciente *</label>
            <select required value={patientId} onChange={e => setPatientId(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800">
              <option value="">— Selecione uma paciente —</option>
              {patients.map(p => (<option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold mb-1">Título *</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Início *</label>
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Término *</label>
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Notas / Observações</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-800" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold">Refeições do Plano</label>
              <button type="button" onClick={addMeal} className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline">+ Adicionar Refeição</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {meals.map((m, idx) => (
                <div key={m.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={m.time} onChange={e => changeMeal(idx, 'time', e.target.value)} placeholder="Horário (ex: 08:00)"
                      className="w-24 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800" />
                    <input type="text" value={m.title} onChange={e => changeMeal(idx, 'title', e.target.value)} placeholder="Título (ex: Café da Manhã)"
                      className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800" />
                    <button type="button" onClick={() => removeMeal(idx)} className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2">✕</button>
                  </div>
                  <input type="text" value={m.description} onChange={e => changeMeal(idx, 'description', e.target.value)} placeholder="Descrição dos alimentos..."
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">Cancelar</button>
            <button type="submit" disabled={submitting || !patientId} className="bg-emerald-600 text-white font-semibold text-sm px-6 py-2.5 rounded-xl">Salvar Alterações</button>
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

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const activeView = normalizeView(currentView);

  const [user, setUser] = useState<User | null>(null);
  const [nutriName, setNutriName] = useState('Dra. Juliana');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [recentPlans, setRecentPlans] = useState<MealPlan[]>([]);
  const [selectedPlanPatientId, setSelectedPlanPatientId] = useState('');

  // ── Dark Mode State ────────────────────────────────────────────────────────
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

  const fetchMealPlans = useCallback(async () => {
    try {
      const { data: plans } = await supabase
        .from('meal_plans')
        .select(`id, title, created_at, start_date, end_date, notes, meals_json, patient_id, nutritionist_id, patients:patient_id(full_name)`)
        .order('created_at', { ascending: false });

      if (plans) setRecentPlans(plans as unknown as MealPlan[]);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: { user: u }, error: ue } = await supabase.auth.getUser();
        if (ue || !u) { setAuthError('Sessão expirada.'); return; }
        if (alive) setUser(u);

        const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', u.id).single();
        if (profile?.role === 'patient') { router.push('/dashboard/patient'); return; }
        if (profile?.role !== 'nutritionist') { setAuthError('Acesso negado.'); return; }
        if (alive) setNutriName(formatDoctorName(profile.full_name, u.email));

        const { data: pts } = await supabase.from('patients').select('*').eq('nutritionist_id', u.id);
        if (alive && pts) {
          setPatients(pts.map((p, i) => ({
            ...p,
            adherence: DEMO_PATIENTS[i % DEMO_PATIENTS.length].adherence,
            status: DEMO_PATIENTS[i % DEMO_PATIENTS.length].status,
            cycleDay: DEMO_PATIENTS[i % DEMO_PATIENTS.length].cycleDay,
            topReason: DEMO_PATIENTS[i % DEMO_PATIENTS.length].topReason,
            planTitle: DEMO_PATIENTS[i % DEMO_PATIENTS.length].planTitle,
            source: 'db' as const,
          })));
        }
        await fetchMealPlans();
      } catch (err) {
        if (alive) setAuthError(String(err));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [router, fetchMealPlans]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editPlanModalOpen, setEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [editPatientModalOpen, setEditPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    setToasts(prev => [...prev, { id: `t-${Date.now()}`, message, kind }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const navItems: { label: string; view: ViewType; icon: string; badge?: string }[] = [
    { label: 'Dashboard',          view: 'dashboard',  icon: '📊' },
    { label: 'Pacientes',          view: 'patients',   icon: '👥' },
    { label: 'Planos Alimentares', view: 'meal-plans', icon: '📋' },
    { label: 'Consultas',          view: 'consultas',  icon: '📅' },
    { label: 'Receitas',           view: 'receitas',   icon: '📖', badge: 'Beta' },
    { label: 'Relatórios',         view: 'reports',    icon: '📈' },
    { label: 'Configurações',      view: 'settings',   icon: '⚙️' },
  ];

  const VIEW_TITLES: Record<NormalizedView, string> = {
    dashboard:    'Visão Geral do Consultório',
    patients:     'Gestão de Pacientes',
    'meal-plans': 'Planos Alimentares',
    consultas:    'Gestão de Consultas e Agendamentos',
    receitas:     'Receitas (Versão Beta)',
    reports:      'Relatórios Clínicos',
    settings:     'Configurações do Consultório',
  };

  const handleCreatePatient = async (data: PatientFormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from('patients').insert({
        nutritionist_id: user.id, full_name: data.full_name, email: data.email || null,
        phone: data.phone || null, objective: data.objective || null, notes: data.notes || null,
      }).select().single();
      if (error) { addToast(error.message, 'error'); return; }
      addToast('Paciente cadastrada com sucesso!', 'success');
      setPatientModalOpen(false);
      setPatients(prev => [{ ...inserted, adherence: 80, status: 'green', cycleDay: 1, source: 'db' }, ...prev]);
    } finally { setSubmitting(false); }
  };

  const handleUpdatePatient = async (data: PatientFormData) => {
    if (!user || !editingPatient) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('patients').update({
        full_name: data.full_name, email: data.email || null,
        phone: data.phone || null, objective: data.objective || null, notes: data.notes || null,
      }).eq('id', editingPatient.id);
      if (error) { addToast(error.message, 'error'); return; }
      addToast('Paciente atualizada com sucesso!', 'success');
      setEditPatientModalOpen(false);
      setEditingPatient(null);
    } finally { setSubmitting(false); }
  };

  const handleDeletePlan = async (planId: string, planTitle: string) => {
    if (!window.confirm(`Excluir o plano "${planTitle}"?`)) return;
    const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
    if (error) { addToast(error.message, 'error'); return; }
    addToast('Plano excluído com sucesso!', 'success');
    setRecentPlans(prev => prev.filter(p => p.id !== planId));
  };

  const handleCreatePlan = async (data: PlanFormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('meal_plans').insert({
        patient_id: data.patientId, nutritionist_id: user.id,
        title: data.title, start_date: data.startDate, end_date: data.endDate,
        notes: data.notes || null, meals_json: data.meals,
      });
      if (error) { addToast(error.message, 'error'); return; }
      addToast('Plano gravado com sucesso!', 'success');
      setPlanModalOpen(false);
      await fetchMealPlans();
    } finally { setSubmitting(false); }
  };

  const handleUpdatePlan = async (data: PlanFormData) => {
    if (!user || !editingPlan) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('meal_plans').update({
        patient_id: data.patientId,
        title: data.title,
        start_date: data.startDate,
        end_date: data.endDate,
        notes: data.notes || null,
        meals_json: data.meals,
      }).eq('id', editingPlan.id);
      if (error) { addToast(error.message, 'error'); return; }
      addToast('Plano atualizado com sucesso!', 'success');
      setEditPlanModalOpen(false);
      setEditingPlan(null);
      await fetchMealPlans();
    } finally { setSubmitting(false); }
  };

  const handleUpdateProfile = async (newFullName: string, newEmail: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await supabase.from('profiles').update({ full_name: newFullName, email: newEmail }).eq('id', user.id);
      setNutriName(formatDoctorName(newFullName, newEmail));
      addToast('Perfil atualizado com sucesso!', 'success');
    } finally { setSubmitting(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 flex items-center justify-center text-slate-500">Carregando painel…</div>;
  }

  if (authError) {
    return <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 flex items-center justify-center p-4 text-center">Erro: {authError}</div>;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row font-sans">

        {/* Mobile Header */}
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div onClick={() => setCurrentView('dashboard')} className="flex items-center gap-2 cursor-pointer">
            <span className="text-2xl">🌿</span>
            <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">NutriAdesão</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex md:hidden">
            <div className="w-72 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌿</span>
                    <div>
                      <span className="font-bold text-sm block">NutriAdesão</span>
                      <span className="text-[10px] text-slate-500">Sistema de gestão nutricional</span>
                    </div>
                  </div>
                  <button onClick={() => setMobileOpen(false)} className="text-slate-400 font-bold text-lg">✕</button>
                </div>
                <nav className="py-6 space-y-1">
                  {navItems.map(item => {
                    const active = normalizeView(item.view) === activeView;
                    return (
                      <button key={item.view} onClick={() => { setCurrentView(item.view); setMobileOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? 'bg-slate-100 dark:bg-slate-800 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                        <div className="flex items-center gap-3">
                          <span>{item.icon}</span><span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                  <span>{isDarkMode ? '☀️' : '🌙'}</span><span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
                <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-rose-600">Sair da conta</button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Desktop Sidebar (Refactored to match exact user request) */}
        <aside className="hidden md:flex w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between shrink-0 min-h-screen sticky top-0 z-30 shadow-xs">
          <div>
            {/* Top Brand / Logo Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div 
                onClick={() => setCurrentView('dashboard')} 
                className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer group"
              >
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
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-3 space-y-1">
              {navItems.map(item => {
                const active = normalizeView(item.view) === activeView;
                const isDashboard = item.view === 'dashboard' || item.view === 'inicio';
                return (
                  <button 
                    key={item.view} 
                    onClick={() => setCurrentView(item.view)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      active 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                        {item.badge}
                      </span>
                    ) : isDashboard ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">Página inicial</span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer Actions (Theme Toggle & Logout) */}
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

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{VIEW_TITLES[activeView]}</h2>
            <div className="flex items-center gap-3">
              {activeView === 'patients' && (
                <button onClick={() => setPatientModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs">
                  ＋ Nova Paciente
                </button>
              )}
              {(activeView === 'dashboard' || activeView === 'meal-plans') && (
                <button onClick={() => setPlanModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition shadow-xs">
                  + Novo Plano Alimentar
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            {activeView === 'dashboard' && (
              <DashboardView nutriName={nutriName} patients={patients} recentPlans={recentPlans} onNavigate={setCurrentView} onCreatePlan={() => setPlanModalOpen(true)} onDeletePlan={handleDeletePlan} onEditPlan={p => { setEditingPlan(p); setEditPlanModalOpen(true); }} />
            )}
            {activeView === 'patients' && (
              <PatientsView patients={patients} onNewPatient={() => setPatientModalOpen(true)} onEditPatient={p => { setEditingPatient(p); setEditPatientModalOpen(true); }} />
            )}
            {activeView === 'meal-plans' && (
              <MealPlansView plans={recentPlans} patients={patients} selectedPatientId={selectedPlanPatientId} onSelectPatient={setSelectedPlanPatientId} onCreatePlan={() => setPlanModalOpen(true)} onDeletePlan={handleDeletePlan} onEditPlan={p => { setEditingPlan(p); setEditPlanModalOpen(true); }} />
            )}
            {activeView === 'receitas' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Receitas 📖</h1>
                    <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold px-3 py-1 rounded-full">Versão Beta</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Cadastre e gerencie receitas saudáveis para recomendar aos seus pacientes (Recursos em desenvolvimento).</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
                  <div className="text-4xl">📖</div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Biblioteca de Receitas em Breve</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Em breve você poderá criar, salvar e vincular receitas personalizadas aos planos alimentares.</p>
                </div>
              </div>
            )}
            {activeView === 'consultas' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                  <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Gestão de Consultas 📅</h1>
                </div>
              </div>
            )}
            {activeView === 'reports' && <ReportsView />}
            {activeView === 'settings' && <SettingsView user={user} nutriName={nutriName} onUpdateProfile={handleUpdateProfile} submitting={submitting} />}
          </main>
        </div>
      </div>

      <NewPatientModal isOpen={patientModalOpen} onClose={() => setPatientModalOpen(false)} onSubmit={handleCreatePatient} submitting={submitting} />
      <EditPatientModal isOpen={editPatientModalOpen} onClose={() => { setEditPatientModalOpen(false); setEditingPatient(null); }} patient={editingPatient} onSubmit={handleUpdatePatient} submitting={submitting} />
      <CreatePlanModal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} patients={patients} onSubmit={handleCreatePlan} submitting={submitting} />
      <EditPlanModal isOpen={editPlanModalOpen} onClose={() => { setEditPlanModalOpen(false); setEditingPlan(null); }} patients={patients} plan={editingPlan} onSubmit={handleUpdatePlan} submitting={submitting} />
    </>
  );
}
