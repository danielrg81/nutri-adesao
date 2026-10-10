'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import NutriLayout from '@/app/components/NutriLayout';

export default function ConfiguracoesPage() {
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
        console.error('Erro em ConfiguracoesPage:', err);
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
        Carregando configurações...
      </div>
    );
  }

  return (
    <NutriLayout title="Configurações do Consultório" user={user}>
      <div className="space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Configurações ⚙️</h1>
          <p className="text-slate-500 text-sm">Ajustes da conta e preferências profissionais.</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4 max-w-xl">
          <h2 className="text-base font-bold text-slate-900">Perfil Profissional</h2>
          <div className="space-y-2 text-xs text-slate-600">
            <p><strong>Email da Conta:</strong> {user?.email || 'Nenhum registo encontrado'}</p>
            <p><strong>Papel:</strong> Nutricionista</p>
          </div>
        </div>
      </div>
    </NutriLayout>
  );
}
