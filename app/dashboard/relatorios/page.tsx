'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import NutriLayout from '@/app/components/NutriLayout';

export default function RelatoriosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        if (isMounted) setUser(userData?.user || null);
      } catch (err) {
        console.error('Erro em RelatoriosPage:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    checkAuth();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA] flex items-center justify-center text-slate-500 font-medium">
        Carregando relatórios...
      </div>
    );
  }

  return (
    <NutriLayout title="Relatórios Clínicos" user={user}>
      <div className="space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Relatórios de Adesão 📈</h1>
          <p className="text-slate-500 text-sm">Relatórios analíticos de adesão e progresso das pacientes.</p>
        </div>

        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📊</div>
          <h3 className="text-base font-bold text-slate-900">Nenhum registo encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ainda não há dados suficientes para gerar relatórios detalhados.
          </p>
        </div>
      </div>
    </NutriLayout>
  );
}
