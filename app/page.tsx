'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'select' | 'patient-login' | 'nutritionist-login'>('select');

  // Formulários
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkSessionAndRedirect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'nutritionist') {
          router.push('/dashboard/nutri');
          return;
        } else if (profile?.role === 'patient') {
          router.push('/dashboard/patient');
          return;
        }
      }
      setLoading(false);
    }

    checkSessionAndRedirect();
  }, [router]);

  const handlePatientMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { role: 'patient' }
      }
    });

    setSubmitting(false);
    if (error) {
      setMessage(`Erro: ${error.message}`);
    } else {
      setMessage('✨ Link mágico enviado! Verifique seu e-mail para entrar.');
    }
  };

  const handleNutritionistLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setSubmitting(false);
      setMessage(`Erro ao entrar: ${error.message}`);
      return;
    }

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      setSubmitting(false);

      if (profileError || !profile) {
        setMessage('Erro ao carregar perfil do utilizador.');
        return;
      }

      if (profile.role === 'nutritionist') {
        router.push('/dashboard/nutri');
      } else {
        router.push('/dashboard/patient');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setAuthMode('select'); setMessage(''); }}>
          <span className="text-2xl">🥗</span>
          <span className="font-bold text-lg text-emerald-900">NutriAdesão</span>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 md:p-8">
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
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? 'Enviando...' : 'Enviar Link de Acesso'}
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
                disabled={submitting}
                className="w-full bg-teal-800 hover:bg-teal-900 text-white font-semibold py-3 px-4 rounded-xl transition shadow-xs disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? 'Entrando...' : 'Entrar no Painel'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
